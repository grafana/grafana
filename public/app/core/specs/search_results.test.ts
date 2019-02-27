import { SearchResultsCtrl } from '../components/search/search_results';
import { beforeEach, afterEach } from 'test/lib/common';
import appEvents from 'app/core/app_events';

jest.mock('app/core/app_events', () => {
  return {
    emit: jest.fn(),
  };
});

describe('SearchResultsCtrl', () => {
  let ctrl;

  describe('when checking an item that is not checked', () => {
    const item = { checked: false };
    let selectionChanged = false;

    beforeEach(() => {
      ctrl = new SearchResultsCtrl({});
      ctrl.onSelectionChanged = () => (selectionChanged = true);
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
    const item = { checked: true };
    let selectionChanged = false;

    beforeEach(() => {
      ctrl = new SearchResultsCtrl({});
      ctrl.onSelectionChanged = () => (selectionChanged = true);
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
      ctrl.onTagSelected = tag => (selectedTag = tag);
      ctrl.selectTag('tag-test');
    });

    it('should trigger tag selected callback', () => {
      expect(selectedTag['$tag']).toBe('tag-test');
    });
  });

  describe('when toggle a collapsed folder', () => {
    let folderExpanded = false;

    beforeEach(() => {
      ctrl = new SearchResultsCtrl({});
      ctrl.onFolderExpanding = () => {
        folderExpanded = true;
      };

      const folder = {
        expanded: false,
        toggle: () => Promise.resolve(folder),
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
      ctrl.onFolderExpanding = () => {
        folderExpanded = true;
      };

      const folder = {
        expanded: true,
        toggle: () => Promise.resolve(folder),
      };

      ctrl.toggleFolderExpand(folder);
    });

    it('should not trigger folder expanding callback', () => {
      expect(folderExpanded).toBeFalsy();
    });
  });

  describe('when clicking on a link in search result', () => {
    const dashPath = 'dashboard/path';
    const $location = { path: () => dashPath };
    const appEventsMock = appEvents as any;

    describe('with the same url as current path', () => {
      beforeEach(() => {
        ctrl = new SearchResultsCtrl($location);
        const item = { url: dashPath };
        ctrl.onItemClick(item);
      });

      it('should close the search', () => {
        expect(appEventsMock.emit.mock.calls.length).toBe(1);
        expect(appEventsMock.emit.mock.calls[0][0]).toBe('hide-dash-search');
      });
    });

    describe('with a different url than current path', () => {
      beforeEach(() => {
        ctrl = new SearchResultsCtrl($location);
        const item = { url: 'another/path' };
        ctrl.onItemClick(item);
      });

      it('should do nothing', () => {
        expect(appEventsMock.emit.mock.calls.length).toBe(0);
      });
    });

    afterEach(() => {
      appEventsMock.emit.mockClear();
    });
  });
});
