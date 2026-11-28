import { render } from '@testing-library/react';

import { FLAME_GRAPH } from '../../liveScenario';
import { sameKeyWarnings } from '../../testFixtures';

import { FlameGraphPanel } from './FlameGraphPanel';

afterEach(() => {
  jest.restoreAllMocks();
  FLAME_GRAPH.levels.length = 0;
});

describe('FlameGraphPanel', () => {
  it('draws every frame of a level whose frames share a name, with no duplicate key warning', () => {
    FLAME_GRAPH.levels.push([
      { start: 0, width: 0.5, color: 'blue', name: 'runtime.mallocgc' },
      { start: 0.5, width: 0.25, color: 'blue', name: 'runtime.mallocgc' },
    ]);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(<FlameGraphPanel />);

    expect(
      Array.from(container.querySelectorAll<HTMLElement>('[style*="left"]')).map((frame) => frame.style.width)
    ).toEqual(['50%', '25%']);
    expect(sameKeyWarnings(consoleError)).toEqual([]);
  });
});
