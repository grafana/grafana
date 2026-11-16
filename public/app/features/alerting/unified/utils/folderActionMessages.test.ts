import { getFolderActionResultMessage } from './folderActionMessages';

describe('getFolderActionResultMessage', () => {
  describe('pause', () => {
    it('reports the affected count when rules were paused and none were skipped', () => {
      expect(getFolderActionResultMessage('pause', { affected: 10, skipped: 0 })).toBe(
        'Rules evaluation successfully paused for folder. Paused 10 rules.'
      );
    });

    it('reports both the affected and skipped counts when some rules were skipped', () => {
      expect(getFolderActionResultMessage('pause', { affected: 10, skipped: 10 })).toBe(
        'Rules evaluation successfully paused for folder. Paused 10 rules. Skipped 10 provisioned rules.'
      );
    });

    it('reports a "no rules affected" message combined with the skipped count when everything was skipped', () => {
      expect(getFolderActionResultMessage('pause', { affected: 0, skipped: 10 })).toBe(
        'No rules were paused for folder. Skipped 10 provisioned rules.'
      );
    });

    it('reports only a "no rules affected" message when nothing was affected or skipped', () => {
      expect(getFolderActionResultMessage('pause', { affected: 0, skipped: 0 })).toBe(
        'No rules were paused for folder.'
      );
    });

    it('falls back to the count-less message when the backend response has no counts (old backend)', () => {
      expect(getFolderActionResultMessage('pause')).toBe('Rules evaluation successfully paused for folder.');
    });
  });

  describe('resume', () => {
    it('reports the affected count when rules were resumed and none were skipped', () => {
      expect(getFolderActionResultMessage('resume', { affected: 10, skipped: 0 })).toBe(
        'Rules successfully resumed for folder. Resumed 10 rules.'
      );
    });

    it('reports both the affected and skipped counts when some rules were skipped', () => {
      expect(getFolderActionResultMessage('resume', { affected: 10, skipped: 10 })).toBe(
        'Rules successfully resumed for folder. Resumed 10 rules. Skipped 10 provisioned rules.'
      );
    });

    it('reports a "no rules affected" message combined with the skipped count when everything was skipped', () => {
      expect(getFolderActionResultMessage('resume', { affected: 0, skipped: 10 })).toBe(
        'No rules were resumed for folder. Skipped 10 provisioned rules.'
      );
    });

    it('reports only a "no rules affected" message when nothing was affected or skipped', () => {
      expect(getFolderActionResultMessage('resume', { affected: 0, skipped: 0 })).toBe(
        'No rules were resumed for folder.'
      );
    });

    it('falls back to the count-less message when the backend response has no counts (old backend)', () => {
      expect(getFolderActionResultMessage('resume')).toBe('Rules successfully resumed for folder.');
    });
  });

  describe('delete', () => {
    it('reports the affected count when rules were deleted and none were skipped', () => {
      expect(getFolderActionResultMessage('delete', { affected: 10, skipped: 0 })).toBe(
        'Rules successfully deleted from folder. Deleted 10 rules.'
      );
    });

    it('reports both the affected and skipped counts when some rules were skipped', () => {
      expect(getFolderActionResultMessage('delete', { affected: 10, skipped: 10 })).toBe(
        'Rules successfully deleted from folder. Deleted 10 rules. Skipped 10 provisioned rules.'
      );
    });

    it('reports a "no rules affected" message combined with the skipped count when everything was skipped', () => {
      expect(getFolderActionResultMessage('delete', { affected: 0, skipped: 10 })).toBe(
        'No rules were deleted from folder. Skipped 10 provisioned rules.'
      );
    });

    it('reports only a "no rules affected" message when nothing was affected or skipped', () => {
      expect(getFolderActionResultMessage('delete', { affected: 0, skipped: 0 })).toBe(
        'No rules were deleted from folder.'
      );
    });

    it('falls back to the count-less message when the backend response has no counts (old backend)', () => {
      expect(getFolderActionResultMessage('delete')).toBe('Rules successfully deleted from folder.');
    });
  });
});
