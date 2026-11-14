import { CORE_KINDS } from './coreKinds';

describe('getRoute', () => {
  it('encodes the object name in its page path', () => {
    expect(CORE_KINDS.folder.getRoute('git hub/app')).toBe('/dashboards/f/git%20hub%2Fapp');
  });

  it('adds a slug of the title to a dashboard page path', () => {
    expect(CORE_KINDS.dashboard.getRoute('abc', 'CPU Usage (prod)')).toBe('/d/abc/cpu-usage-prod');
  });

  it('leaves the slug out when no title is given', () => {
    expect(CORE_KINDS.dashboard.getRoute('abc')).toBe('/d/abc');
  });
});
