import { SearchResultsCtrl } from '../components/search/search_results';

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

  describe('when toggle a collapsed folder', () => {
    let folderExpanded = false;

    beforeEach(() => {
      ctrl = new SearchResultsCtrl({});
      ctrl.onFolderExpanding = () => { folderExpanded = true; };

      let folder = {
        expanded: false,
        toggle: () => Promise.resolve(folder)
      };

      ctrl.toggleFolderExpand(folder);
    });

    it('should trigger folder expanding callback', () => {
      expect(folderExpanded).toBeTruthy();
    });
  });

  describe('when toggle an expanded folder', () => {
    let folderExpanded = false;

    beforeEach(() => {
      ctrl = new SearchResultsCtrl({});
      ctrl.onFolderExpanding = () => { folderExpanded = true; };

      let folder = {
        expanded: true,
        toggle: () => Promise.resolve(folder)
      };

      ctrl.toggleFolderExpand(folder);
    });

    it('should not trigger folder expanding callback', () => {
      expect(folderExpanded).toBeFalsy();
    });
  });
});
