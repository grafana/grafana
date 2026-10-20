import { resourceTypeDisplayNames, resourceTypes } from './resourceTypes';

describe('Azure Monitor metric resource types', () => {
  it('includes edge machines in fallback discovery with a readable label', () => {
    expect(resourceTypes).toContain('microsoft.azurestackhci/edgemachines');
    expect(resourceTypeDisplayNames['microsoft.azurestackhci/edgemachines']).toBe('Azure Stack HCI edge machines');
  });
});
