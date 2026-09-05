import { defaultSpec, type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import type { DashboardScene } from '../../scene/DashboardScene';
import { computeRevisionToken, REVISION_MISMATCH } from '../dashboardRevision';

import { applySpecCommand } from './applySpec';
import { getSpecCommand } from './getSpec';
import type { MutationContext } from './types';

const mockTransformSceneToSaveModelSchemaV2 = jest.fn();
const mockTransformSaveModelSchemaV2ToScene = jest.fn();

jest.mock('../../serialization/transformSceneToSaveModelSchemaV2', () => ({
  transformSceneToSaveModelSchemaV2: (scene: unknown) => mockTransformSceneToSaveModelSchemaV2(scene),
}));

jest.mock('../../serialization/transformSaveModelSchemaV2ToScene', () => ({
  transformSaveModelSchemaV2ToScene: (dto: unknown) => mockTransformSaveModelSchemaV2ToScene(dto),
}));

jest.mock('@grafana/scenes', () => ({
  sceneUtils: { cloneSceneObjectState: (state: unknown) => state },
}));

jest.mock('app/features/dashboard/api/DashboardAPIVersionResolver', () => ({
  dashboardAPIVersionResolver: { getV2: () => 'dashboard.grafana.app/v2' },
}));

/** APPLY_SPEC takes an untyped wire payload; computeRevisionToken takes a typed spec. */
type TestSpec = DashboardV2Spec & Record<string, unknown>;

function makeSpec(title = 'Test'): TestSpec {
  return { ...defaultSpec(), title };
}

const spec = makeSpec();

/** A scene stub with just the surface APPLY_SPEC touches on the success path. */
function makeContext() {
  const onEnterEditMode = jest.fn();
  const setState = jest.fn();
  const scene = {
    state: { isEditing: true, key: 'scene-key', meta: {} },
    onEnterEditMode,
    activateSidebar: jest.fn(),
    serializer: { getK8SMetadata: () => ({ name: 'dash-uid', generation: 1, creationTimestamp: '2026-01-01' }) },
    setState,
  };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- structural stub of the DashboardScene surface this command reads
  const context: MutationContext = { scene: scene as unknown as DashboardScene };
  return { context, onEnterEditMode, setState };
}

describe('revision tokens', () => {
  afterEach(() => {
    mockTransformSaveModelSchemaV2ToScene.mockReset();
    mockTransformSceneToSaveModelSchemaV2.mockReset();
  });

  it('is stable for identical content and differs for changed content', () => {
    expect(computeRevisionToken(makeSpec())).toBe(computeRevisionToken(makeSpec()));
    expect(computeRevisionToken(makeSpec('Other'))).not.toBe(computeRevisionToken(makeSpec()));
  });

  it('is reported by GET_SPEC for the spec it returns', async () => {
    mockTransformSceneToSaveModelSchemaV2.mockReturnValue(spec);

    const result = await getSpecCommand.handler({ validate: false }, makeContext().context);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ spec, revision: computeRevisionToken(spec) });
  });
});

describe('APPLY_SPEC expectedRevision', () => {
  afterEach(() => {
    mockTransformSaveModelSchemaV2ToScene.mockReset();
    mockTransformSceneToSaveModelSchemaV2.mockReset();
  });

  it('is optional, so existing callers apply unconditionally', async () => {
    const parsed = applySpecCommand.payloadSchema.safeParse({ spec });
    expect(parsed.success).toBe(true);

    mockTransformSaveModelSchemaV2ToScene.mockReturnValue({ state: {} });
    mockTransformSceneToSaveModelSchemaV2.mockReturnValue(spec);

    const result = await applySpecCommand.handler({ spec, validate: false }, makeContext().context);

    expect(result.success).toBe(true);
    // Not merely unenforced: the live scene is never serialized for CAS when
    // the caller opted out — only the post-apply echo serialize runs.
    expect(mockTransformSceneToSaveModelSchemaV2).toHaveBeenCalledTimes(1);
  });

  it('applies when the token still matches', async () => {
    const live = makeSpec('Live');
    mockTransformSceneToSaveModelSchemaV2.mockReturnValue(live);
    mockTransformSaveModelSchemaV2ToScene.mockReturnValue({ state: {} });

    const result = await applySpecCommand.handler(
      { spec, validate: false, expectedRevision: computeRevisionToken(live) },
      makeContext().context
    );

    expect(result.success).toBe(true);
    expect(mockTransformSaveModelSchemaV2ToScene).toHaveBeenCalled();
  });

  it('rejects a stale apply without mutating the scene and returns the live spec', async () => {
    const live = makeSpec('User edited');
    mockTransformSceneToSaveModelSchemaV2.mockReturnValue(live);
    const { context, onEnterEditMode, setState } = makeContext();

    const result = await applySpecCommand.handler(
      { spec, validate: false, expectedRevision: computeRevisionToken(makeSpec('Stale')) },
      context
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe(REVISION_MISMATCH);
    expect(result.data).toEqual({
      expectedRevision: computeRevisionToken(makeSpec('Stale')),
      currentRevision: computeRevisionToken(live),
      spec: live,
    });
    expect(mockTransformSaveModelSchemaV2ToScene).not.toHaveBeenCalled();
    expect(onEnterEditMode).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });

  it('rejects rather than overwrites when the current revision cannot be read', async () => {
    mockTransformSceneToSaveModelSchemaV2.mockImplementation(() => {
      throw new Error('scene is unserializable');
    });
    const { context, setState } = makeContext();

    const result = await applySpecCommand.handler({ spec, validate: false, expectedRevision: 'rev-1' }, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('scene is unserializable');
    expect(setState).not.toHaveBeenCalled();
  });

  it('returns the post-apply revision so a caller can chain applies', async () => {
    const live = makeSpec('Live');
    const applied = makeSpec('Applied');
    mockTransformSaveModelSchemaV2ToScene.mockReturnValue({ state: {} });
    mockTransformSceneToSaveModelSchemaV2
      .mockReturnValueOnce(live) // CAS check
      .mockReturnValueOnce(applied); // post-apply echo

    const result = await applySpecCommand.handler(
      { spec, validate: false, expectedRevision: computeRevisionToken(live) },
      makeContext().context
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ applied: true, spec: applied, revision: computeRevisionToken(applied) });
  });
});
