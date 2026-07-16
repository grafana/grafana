import type { DashboardScene } from '../../scene/DashboardScene';

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

// A structurally valid stable-v2 spec (empty grid layout, defaults elsewhere).
const validSpec = {
  title: 'Test',
  cursorSync: 'Off',
  preload: false,
  editable: true,
  tags: [],
  annotations: [],
  links: [],
  variables: [],
  elements: {},
  layout: { kind: 'GridLayout', spec: { items: [] } },
  timeSettings: {
    from: 'now-6h',
    to: 'now',
    autoRefresh: '',
    autoRefreshIntervals: [],
    hideTimepicker: false,
    fiscalYearStartMonth: 0,
  },
};

// Missing the required `layout`/`title` and using a bogus cursorSync value.
const invalidSpec = { cursorSync: 'nope', timeSettings: {} };

// The scene is only reached after validation passes, so an invalid-spec test
// never touches it.
const stubContext = { scene: {} as DashboardScene } satisfies MutationContext;

// A scene stub with just the surface APPLY_SPEC touches on the success path
// (edit-mode entry, metadata envelope, state swap), so the rebuild is reached.
function makeSceneContext(): MutationContext {
  const scene = {
    state: { isEditing: true, key: 'scene-key', meta: {} },
    onEnterEditMode: jest.fn(),
    activateEditPane: jest.fn(),
    serializer: {
      getK8SMetadata: () => ({ name: 'dash-uid', generation: 1, creationTimestamp: '2026-01-01T00:00:00Z' }),
    },
    setState: jest.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- structural stub of the DashboardScene surface this command reads
  return { scene: scene as unknown as DashboardScene } satisfies MutationContext;
}

describe('APPLY_SPEC validate flag', () => {
  const sceneContext = makeSceneContext();

  afterEach(() => {
    mockTransformSaveModelSchemaV2ToScene.mockReset();
    mockTransformSceneToSaveModelSchemaV2.mockReset();
  });

  it('defaults `validate` to false in the payload schema (non-breaking)', () => {
    const parsed = applySpecCommand.payloadSchema.safeParse({ spec: {} });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrow inferred payload for the assertion
      expect((parsed.data as { validate: boolean }).validate).toBe(false);
    }
  });

  it('rejects an invalid spec with a structured error when validate is true', async () => {
    const result = await applySpecCommand.handler({ spec: invalidSpec, validate: true }, stubContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
    expect(result.changes).toEqual([]);
  });

  it('rebuilds from the normalized (parsed) spec when validate is true', async () => {
    // Simulates Go's nil-slice serialization: arrays arrive as `null`. The schema
    // normalizes these to `[]`, and the rebuild must see the normalized shape.
    const specWithNulls = {
      ...validSpec,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- exercise Go's null-for-nil-slice payload
      tags: null as unknown as string[],
      annotations: null as unknown as [],
      links: null as unknown as [],
      variables: null as unknown as [],
    };
    mockTransformSaveModelSchemaV2ToScene.mockReturnValue({ state: {} });

    const result = await applySpecCommand.handler({ spec: specWithNulls, validate: true }, sceneContext);

    expect(result.success).toBe(true);
    const dto = mockTransformSaveModelSchemaV2ToScene.mock.calls[0][0];
    expect(dto.spec.tags).toEqual([]);
    expect(dto.spec.annotations).toEqual([]);
    expect(dto.spec.links).toEqual([]);
    expect(dto.spec.variables).toEqual([]);
  });

  it('rebuilds from the raw spec untouched when validate is false', async () => {
    mockTransformSaveModelSchemaV2ToScene.mockReturnValue({ state: {} });
    const result = await applySpecCommand.handler({ spec: validSpec, validate: false }, sceneContext);
    expect(result.success).toBe(true);
    const dto = mockTransformSaveModelSchemaV2ToScene.mock.calls[0][0];
    expect(dto.spec).toBe(validSpec);
  });
});

describe('GET_SPEC validate flag', () => {
  afterEach(() => {
    mockTransformSceneToSaveModelSchemaV2.mockReset();
  });

  it('returns the serialized spec unchanged when validate is omitted, even if invalid (non-breaking)', async () => {
    mockTransformSceneToSaveModelSchemaV2.mockReturnValue(invalidSpec);
    const result = await getSpecCommand.handler({ validate: false }, stubContext);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ spec: invalidSpec });
  });

  it('fails with a structured error when validate is true and the spec is invalid', async () => {
    mockTransformSceneToSaveModelSchemaV2.mockReturnValue(invalidSpec);
    const result = await getSpecCommand.handler({ validate: true }, stubContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('succeeds when validate is true and the spec is valid', async () => {
    mockTransformSceneToSaveModelSchemaV2.mockReturnValue(validSpec);
    const result = await getSpecCommand.handler({ validate: true }, stubContext);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ spec: validSpec });
  });
});
