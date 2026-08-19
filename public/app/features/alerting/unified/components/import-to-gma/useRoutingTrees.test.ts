import { getRoutingTreeLabel } from './useRoutingTrees';

describe('getRoutingTreeLabel', () => {
  // Compare against the user-defined label so the assertion is robust to the i18n fallback string.
  it.each(['user-defined', 'default', ''])('labels the default tree (%p) as the default policy', (name) => {
    expect(getRoutingTreeLabel(name)).toBe(getRoutingTreeLabel('user-defined'));
  });

  it('returns the raw name for a named routing tree', () => {
    expect(getRoutingTreeLabel('team-backend')).toBe('team-backend');
  });
});
