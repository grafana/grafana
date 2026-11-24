import { DashboardScene } from '../DashboardScene';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { isActiveDashboardV2, isDashboardSceneLike } from './dashboard';

describe('isDashboardSceneLike', () => {
  it('recognizes the explicit dashboard scene marker', () => {
    expect(isDashboardSceneLike({ isDashboardScene: true })).toBe(true);
  });

  it('rejects other scene markers', () => {
    expect(isDashboardSceneLike({ isNotebookScene: true })).toBe(false);
  });

  it('rejects a false dashboard marker', () => {
    expect(isDashboardSceneLike({ isDashboardScene: false })).toBe(false);
  });
});

describe('isActiveDashboardV2', () => {
  it('is true only while a v2 dashboard is active', () => {
    const v2 = new DashboardScene({ body: DefaultGridLayoutManager.fromVizPanels([]) }, 'v2');
    const v1 = new DashboardScene({ body: DefaultGridLayoutManager.fromVizPanels([]) }, 'v1');

    const deactivateV2 = v2.activate();
    expect(isActiveDashboardV2()).toBe(true);
    deactivateV2();
    expect(isActiveDashboardV2()).toBe(false);

    const deactivateV1 = v1.activate();
    expect(isActiveDashboardV2()).toBe(false);
    deactivateV1();
  });
});
