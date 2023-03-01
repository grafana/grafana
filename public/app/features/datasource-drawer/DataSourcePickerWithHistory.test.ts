import { updateHistory } from './DataSourcePickerWithHistory';

describe('DataSourcePickerWithHistory', () => {
  describe('updateHistory', () => {
    const early = { uid: 'b', lastUse: '2023-02-27T13:39:08.318Z' };
    const later = { uid: 'a', lastUse: '2023-02-28T13:39:08.318Z' };

    it('should add an item to the history', () => {
      expect(updateHistory([], early)).toEqual([early]);
    });

    it('should sort later entries first', () => {
      expect(updateHistory([early], later)).toEqual([later, early]);
    });

    it('should update an already existing history item with the new lastUsed date', () => {
      const laterB = { uid: early.uid, lastUse: later.lastUse };
      expect(updateHistory([early], laterB)).toEqual([laterB]);
    });

    it('should keep the three latest items in history', () => {
      const evenLater = { uid: 'c', lastUse: '2023-03-01T13:39:08.318Z' };
      const latest = { uid: 'd', lastUse: '2023-03-02T13:39:08.318Z' };
      expect(updateHistory([early, later, evenLater], latest)).toEqual([latest, evenLater, later]);
    });
  });
});
