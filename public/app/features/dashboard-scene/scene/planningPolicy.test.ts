import { isActionAllowedWhilePlanning, type PlanningAction } from './planningPolicy';

describe('the planning policy', () => {
  it('permits the edits that change the plan itself', () => {
    const planEdits: PlanningAction[] = [
      'add-panel',
      'remove-panel',
      'duplicate-panel',
      'move-panel',
      'resize-panel',
      'rename-panel',
      'change-visualization',
      'set-repeat',
      'edit-plan-panel',
    ];

    for (const action of planEdits) {
      expect(isActionAllowedWhilePlanning(action)).toBe(true);
    }
  });

  it('withholds the panel editor, which would give a placeholder a live query', () => {
    expect(isActionAllowedWhilePlanning('edit-panel')).toBe(false);
  });

  it('withholds actions that need a query the placeholder does not have', () => {
    expect(isActionAllowedWhilePlanning('create-alert-rule')).toBe(false);
    expect(isActionAllowedWhilePlanning('explore-panel')).toBe(false);
    expect(isActionAllowedWhilePlanning('inspect-panel')).toBe(false);
  });

  it('withholds actions that assume a dashboard which does not exist yet', () => {
    expect(isActionAllowedWhilePlanning('save-dashboard')).toBe(false);
    expect(isActionAllowedWhilePlanning('dashboard-settings')).toBe(false);
    expect(isActionAllowedWhilePlanning('share-dashboard')).toBe(false);
  });

  it('withholds carrying a placeholder out of the plan, but allows duplicating within it', () => {
    expect(isActionAllowedWhilePlanning('copy-panel')).toBe(false);
    expect(isActionAllowedWhilePlanning('add-library-panel')).toBe(false);
    expect(isActionAllowedWhilePlanning('duplicate-panel')).toBe(true);
  });
});
