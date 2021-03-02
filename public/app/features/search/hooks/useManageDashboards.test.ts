import { Dispatch } from 'react';
import { renderHook } from '@testing-library/react-hooks';

import * as useSearch from './useSearch';
import { DashboardQuery, DashboardSearchItemType, DashboardSection, SearchAction } from '../types';
import { ManageDashboardsState } from '../reducers/manageDashboards';
import { useManageDashboards } from './useManageDashboards';
import { GENERAL_FOLDER_ID } from '../constants';

describe('useManageDashboards', () => {
  const useSearchMock = jest.spyOn(useSearch, 'useSearch');
  const toggle = async (section: DashboardSection) => section;

  function setupTestContext({ results = [] }: { results?: DashboardSection[] } = {}) {
    jest.clearAllMocks();

    const state: ManageDashboardsState = {
      results,
      loading: false,
      selectedIndex: 0,
      initialLoading: false,
      allChecked: false,
    };
    const dispatch: Dispatch<SearchAction> = (null as unknown) as Dispatch<SearchAction>;
    useSearchMock.mockReturnValue({ state, dispatch, onToggleSection: toggle });
    const dashboardQuery: DashboardQuery = ({} as unknown) as DashboardQuery;

    const { result } = renderHook(() => useManageDashboards(dashboardQuery, {}));

    return { result };
  }

  describe('when called and only General folder is selected', () => {
    it('then canDelete should be false', () => {
      const results: DashboardSection[] = [
        { id: 1, checked: false, items: [], title: 'One', type: DashboardSearchItemType.DashFolder, toggle, url: '/' },
        {
          id: GENERAL_FOLDER_ID,
          checked: true,
          items: [],
          title: 'General',
          type: DashboardSearchItemType.DashFolder,
          toggle,
          url: '/',
        },
        { id: 2, checked: false, items: [], title: 'Two', type: DashboardSearchItemType.DashFolder, toggle, url: '/' },
      ];

      const { result } = setupTestContext({ results });

      expect(result.current.canDelete).toBe(false);
    });
  });

  describe('when called and General folder and another folder are selected', () => {
    it('then canDelete should be true', () => {
      const results: DashboardSection[] = [
        { id: 1, checked: true, items: [], title: 'One', type: DashboardSearchItemType.DashFolder, toggle, url: '/' },
        {
          id: GENERAL_FOLDER_ID,
          checked: true,
          items: [],
          title: 'General',
          type: DashboardSearchItemType.DashFolder,
          toggle,
          url: '/',
        },
        { id: 2, checked: false, items: [], title: 'Two', type: DashboardSearchItemType.DashFolder, toggle, url: '/' },
      ];

      const { result } = setupTestContext({ results });

      expect(result.current.canDelete).toBe(true);
    });
  });

  describe('when called and no folder is selected', () => {
    it('then canDelete should be false', () => {
      const results: DashboardSection[] = [
        { id: 1, checked: false, items: [], title: 'One', type: DashboardSearchItemType.DashFolder, toggle, url: '/' },
        {
          id: GENERAL_FOLDER_ID,
          checked: false,
          items: [],
          title: 'General',
          type: DashboardSearchItemType.DashFolder,
          toggle,
          url: '/',
        },
        { id: 2, checked: false, items: [], title: 'Two', type: DashboardSearchItemType.DashFolder, toggle, url: '/' },
      ];

      const { result } = setupTestContext({ results });

      expect(result.current.canDelete).toBe(false);
    });
  });
});
