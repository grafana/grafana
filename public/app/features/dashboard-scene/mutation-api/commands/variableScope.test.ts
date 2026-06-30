import type { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import { resolveLayoutPath } from './layoutPathResolver';
import { resolveVariableScope } from './variableScope';

jest.mock('./layoutPathResolver', () => ({
  resolveLayoutPath: jest.fn(),
}));

const mockResolveLayoutPath = jest.mocked(resolveLayoutPath);

function buildMockScene(): DashboardScene {
  const body = DefaultGridLayoutManager.fromVizPanels([]);
  return { state: { body } } as unknown as DashboardScene;
}

describe('resolveVariableScope', () => {
  beforeEach(() => {
    mockResolveLayoutPath.mockReset();
  });

  it('includes resolved item type in invalid variable scope errors', () => {
    const scene = buildMockScene();
    const layoutManager = DefaultGridLayoutManager.fromVizPanels([]);
    const invalidItem = { constructor: { name: 'VizPanel' } } as unknown as ReturnType<
      typeof resolveLayoutPath
    >['item'];

    mockResolveLayoutPath.mockReturnValue({
      layoutManager,
      item: invalidItem,
    });

    expect(() => resolveVariableScope(scene, '/rows/0/panels/0')).toThrow(/resolved item type was "VizPanel"/);
  });
});
