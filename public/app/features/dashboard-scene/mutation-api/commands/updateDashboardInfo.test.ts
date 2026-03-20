import type { DashboardScene } from '../../scene/DashboardScene';
import { DashboardMutationClient } from '../DashboardMutationClient';
import type { MutationResult } from '../types';

function buildMockScene(
  options: { editable?: boolean; isEditing?: boolean; title?: string; description?: string; tags?: string[] } = {}
): DashboardScene {
  const { editable = true, isEditing = false, title = 'Original Title', description = 'Original Description', tags = ['original'] } = options;
  const state: Record<string, unknown> = {
    uid: 'test-dash',
    isEditing,
    title,
    description,
    tags,
  };
  const scene = {
    state,
    canEditDashboard: jest.fn(() => editable),
    onEnterEditMode: jest.fn(() => {
      state.isEditing = true;
    }),
    forceRender: jest.fn(),
    setState: jest.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
    }),
  };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock scene satisfies DashboardScene at runtime
  return scene as unknown as DashboardScene;
}

describe('UPDATE_DASHBOARD_INFO command', () => {
  let client: DashboardMutationClient;
  let scene: ReturnType<typeof buildMockScene>;

  beforeEach(() => {
    scene = buildMockScene();
    client = new DashboardMutationClient(scene);
  });

  it('updates title only', async () => {
    const result: MutationResult = await client.execute({
      type: 'UPDATE_DASHBOARD_INFO',
      payload: { title: 'New Title' },
    });

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toEqual({
      path: 'title',
      previousValue: 'Original Title',
      newValue: 'New Title',
    });
    expect(scene.state.title).toBe('New Title');
  });

  it('updates description only', async () => {
    const result: MutationResult = await client.execute({
      type: 'UPDATE_DASHBOARD_INFO',
      payload: { description: 'New Description' },
    });

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toEqual({
      path: 'description',
      previousValue: 'Original Description',
      newValue: 'New Description',
    });
    expect(scene.state.description).toBe('New Description');
  });

  it('updates tags only', async () => {
    const result: MutationResult = await client.execute({
      type: 'UPDATE_DASHBOARD_INFO',
      payload: { tags: ['new-tag', 'another-tag'] },
    });

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toEqual({
      path: 'tags',
      previousValue: ['original'],
      newValue: ['new-tag', 'another-tag'],
    });
    expect(scene.state.tags).toEqual(['new-tag', 'another-tag']);
  });

  it('updates title, description, and tags together', async () => {
    const result: MutationResult = await client.execute({
      type: 'UPDATE_DASHBOARD_INFO',
      payload: {
        title: 'Combined Title',
        description: 'Combined Description',
        tags: ['tag-a', 'tag-b'],
      },
    });

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(3);
    expect(result.changes[0]).toEqual({
      path: 'title',
      previousValue: 'Original Title',
      newValue: 'Combined Title',
    });
    expect(result.changes[1]).toEqual({
      path: 'description',
      previousValue: 'Original Description',
      newValue: 'Combined Description',
    });
    expect(result.changes[2]).toEqual({
      path: 'tags',
      previousValue: ['original'],
      newValue: ['tag-a', 'tag-b'],
    });
    expect(scene.state.title).toBe('Combined Title');
    expect(scene.state.description).toBe('Combined Description');
    expect(scene.state.tags).toEqual(['tag-a', 'tag-b']);
  });

  it('returns no changes when payload is empty', async () => {
    const result: MutationResult = await client.execute({
      type: 'UPDATE_DASHBOARD_INFO',
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(0);
    // State should remain unchanged
    expect(scene.state.title).toBe('Original Title');
    expect(scene.state.description).toBe('Original Description');
    expect(scene.state.tags).toEqual(['original']);
    // setState should not have been called
    expect(scene.setState).not.toHaveBeenCalled();
  });

  it('enters edit mode when not already editing', async () => {
    expect(scene.state.isEditing).toBe(false);

    await client.execute({
      type: 'UPDATE_DASHBOARD_INFO',
      payload: { title: 'Triggers Edit Mode' },
    });

    expect(scene.onEnterEditMode).toHaveBeenCalled();
    expect(scene.state.isEditing).toBe(true);
  });

  it('does not call onEnterEditMode when already editing', async () => {
    scene = buildMockScene({ isEditing: true });
    client = new DashboardMutationClient(scene);

    await client.execute({
      type: 'UPDATE_DASHBOARD_INFO',
      payload: { title: 'Already Editing' },
    });

    expect(scene.onEnterEditMode).not.toHaveBeenCalled();
  });
});
