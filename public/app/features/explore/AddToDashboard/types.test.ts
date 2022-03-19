import { isSaveToNewDashboardDTO } from './types';

describe('Type guards', () => {
  describe('isSaveToNewDashboardDTO', () => {
    it('Returns `true` if saveTarget is "new_dashboard"', () => {
      expect(isSaveToNewDashboardDTO({ saveTarget: 'new_dashboard', dashboardName: 'Some Name', folderId: 1 })).toBe(
        true
      );
    });
  });
});
