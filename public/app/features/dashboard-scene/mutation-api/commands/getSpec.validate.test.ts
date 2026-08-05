/**
 * The `validate` flag, with the serializer mocked.
 *
 * Apart from the real-scene suite in getSpec.test.ts on purpose, and it has to be: a case about
 * validating a spec the serializer would never emit needs to stand in for the serializer, and jest
 * mocks are file-wide, so it cannot share a file with cases that drive a real one.
 */

import type { DashboardScene } from '../../scene/DashboardScene';

import { getSpecCommand } from './getSpec';
import type { MutationContext } from './types';

const mockTransformSceneToSaveModelSchemaV2 = jest.fn();

jest.mock('../../serialization/transformSceneToSaveModelSchemaV2', () => ({
  transformSceneToSaveModelSchemaV2: (scene: unknown) => mockTransformSceneToSaveModelSchemaV2(scene),
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

// The scene is only reached after validation passes, so an invalid-spec test never touches it.
const stubContext = { scene: {} as DashboardScene } satisfies MutationContext;

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
