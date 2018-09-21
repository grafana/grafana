import {
  getCanDelete,
  getCanMove,
  getHasFilters,
  getSelectedDashboards,
  getSelectedFoldersAndDashboards,
} from './selectors';
import { getMockSectionsWithItems } from '../__mocks__/manageDashboardMock';
import { DashboardQuery, ManageDashboardState, SectionsState } from '../../../types';
import { DashboardTag } from '../../../types/manageDashboard';
import { contextSrv } from '../../../core/services/context_srv';

describe('Manage dashboard selectors', () => {
  describe('Can delete', () => {
    const mockSections = getMockSectionsWithItems(5);

    it('should return false', () => {
      const mockState: SectionsState = {
        sections: mockSections,
        allChecked: false,
        dashboardTags: [] as DashboardTag[],
      };

      const result = getCanDelete(mockState);

      expect(result).toEqual(false);
    });

    it('should return true if something is checked', () => {
      mockSections[0].checked = true;

      const mockState: SectionsState = {
        sections: mockSections,
        allChecked: false,
        dashboardTags: [] as DashboardTag[],
      };

      const result = getCanDelete(mockState);

      expect(result).toEqual(true);
    });
  });

  describe('Can move', () => {
    const mockSections = getMockSectionsWithItems(5);

    it('should return false', () => {
      const mockState: SectionsState = {
        sections: mockSections,
        allChecked: false,
        dashboardTags: [] as DashboardTag[],
      };

      const result = getCanMove(mockState);

      expect(result).toEqual(false);
    });
  });

  describe('has filters', () => {
    const mockManageDashboard = {
      selectAllChecked: false,
      canMove: false,
      canDelete: false,
      canSave: false,
      hasFilters: false,
      folderId: 0,
      folderUid: '',
      hasEditPermissionInFolders: contextSrv.hasEditPermissionInFolders,
      isEditor: contextSrv.isEditor,
      filterOnStarred: false,
      selectedTagFilter: '',
    };

    it('should return false', () => {
      const mockDashboardQuery: DashboardQuery = {
        query: '',
        mode: 'tree',
        tag: [],
        starred: false,
        skipRecent: true,
        skipStarred: true,
        folderIds: [],
      };

      const mockState: ManageDashboardState = {
        dashboardQuery: mockDashboardQuery,
        manageDashboard: mockManageDashboard,
      };

      const result = getHasFilters(mockState);

      expect(result).toEqual(false);
    });

    it('should return true', () => {
      const mockDashboardQuery: DashboardQuery = {
        query: '',
        mode: 'tree',
        tag: [],
        starred: true,
        skipRecent: true,
        skipStarred: true,
        folderIds: [],
      };

      const mockState: ManageDashboardState = {
        dashboardQuery: mockDashboardQuery,
        manageDashboard: mockManageDashboard,
      };

      const result = getHasFilters(mockState);

      expect(result).toEqual(true);
    });
  });

  describe('get selected dashboards', () => {
    const mockSections = getMockSectionsWithItems(5);

    it('should return 0', () => {
      const mockState: SectionsState = {
        sections: mockSections,
        allChecked: false,
        dashboardTags: [] as DashboardTag[],
      };

      const result = getSelectedDashboards(mockState);

      expect(result.length).toEqual(0);
    });

    it('should return 2', () => {
      mockSections[0].items[0].checked = true;
      mockSections[1].items[1].checked = true;

      const mockState: SectionsState = {
        sections: mockSections,
        allChecked: false,
        dashboardTags: [] as DashboardTag[],
      };

      const result = getSelectedDashboards(mockState);

      expect(result.length).toEqual(2);
    });
  });
});

describe('Get selected dashboards and folders', () => {
  const mockSections = getMockSectionsWithItems(5);
  mockSections[0].checked = true;
  mockSections[0].items[0].checked = true;
  mockSections[2].checked = true;
  mockSections[3].items[2].checked = true;
  mockSections[3].items[1].checked = true;

  const mockState: SectionsState = {
    sections: mockSections,
    allChecked: false,
    dashboardTags: [] as DashboardTag[],
  };

  const result = getSelectedFoldersAndDashboards(mockState);

  it('should have 2 selected folders', () => {
    expect(result.folders.length).toEqual(2);
  });

  it('should have 3 selected dashboards', () => {
    expect(result.dashboards.length).toEqual(3);
  });
});
