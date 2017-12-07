import { SearchResultsCtrl } from './search_results';

describe('SearchResultsCtrl', () => {
  let ctrl;

  describe('when checking an item that is not checked', () => {
    let item = {checked: false};
    let selectionChanged = false;

    beforeEach(() => {
      ctrl = new SearchResultsCtrl({});
      ctrl.onSelectionChanged = () => selectionChanged = true;
      ctrl.toggleSelection(item);
    });

    it('should set checked to true', () => {
      expect(item.checked).toBeTruthy();
    });

    it('should trigger selection changed callback', () => {
      expect(selectionChanged).toBeTruthy();
    });
  });

  describe('when checking an item that is checked', () => {
    let item = {checked: true};
    let selectionChanged = false;

    beforeEach(() => {
      ctrl = new SearchResultsCtrl({});
      ctrl.onSelectionChanged = () => selectionChanged = true;
      ctrl.toggleSelection(item);
    });

    it('should set checked to false', () => {
      expect(item.checked).toBeFalsy();
    });

    it('should trigger selection changed callback', () => {
      expect(selectionChanged).toBeTruthy();
    });
  });

  describe('when selecting a tag', () => {
    let selectedTag = null;

    beforeEach(() => {
      ctrl = new SearchResultsCtrl({});
      ctrl.onTagSelected = (tag) => selectedTag = tag;
      ctrl.selectTag('tag-test');
    });

    it('should trigger tag selected callback', () => {
      expect(selectedTag["$tag"]).toBe('tag-test');
    });
  });

  describe('when toggle a folder', () => {
    let folderToggled = false;
    let folder = {
      toggle: () => {
        folderToggled = true;
      }
    };

    beforeEach(() => {
      ctrl = new SearchResultsCtrl({});
      ctrl.toggleFolderExpand(folder);
    });

    it('should trigger folder toggle callback', () => {
      expect(folderToggled).toBeTruthy();
    });
  });
});
