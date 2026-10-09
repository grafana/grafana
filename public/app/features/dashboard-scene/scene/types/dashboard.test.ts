import { isDashboardSceneLike } from './dashboard';

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
