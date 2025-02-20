import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PanelPluginMeta, PluginMetaInfo, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Panel } from '@grafana/schema';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { backendSrv } from '../../../../core/services/backend_srv';
import * as panelUtils from '../../../panel/state/util';
import * as api from '../../state/api';
import { LibraryElementsSearchResult } from '../../types';

import { LibraryPanelsSearch, LibraryPanelsSearchProps } from './LibraryPanelsSearch';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    panels: {
      timeseries: {
        info: { logos: { small: '' } },
        name: 'Time Series',
      },
    },
  },
}));

jest.mock('debounce-promise', () => {
  const debounce = () => {
    const debounced = () =>
      Promise.resolve([
        { label: 'Dashboards', value: { uid: '', title: 'Dashboards' } },
        { label: 'Folder1', value: { id: 'xMsQdBfWz', title: 'Folder1' } },
        { label: 'Folder2', value: { id: 'wfTJJL5Wz', title: 'Folder2' } },
      ]);
    return debounced;
  };

  return debounce;
});

jest.spyOn(api, 'getConnectedDashboards').mockResolvedValue([]);
jest.spyOn(api, 'deleteLibraryPanel').mockResolvedValue({ message: 'success' });
async function getTestContext(
  propOverrides: Partial<LibraryPanelsSearchProps> = {},
  searchResult: LibraryElementsSearchResult = { elements: [], perPage: 40, page: 1, totalCount: 0 }
) {
  jest.clearAllMocks();
  const pluginInfo = { logos: { small: '', large: '' } } as PluginMetaInfo;
  const graph: PanelPluginMeta = {
    name: 'Graph',
    id: 'graph',
    info: pluginInfo,
    baseUrl: '',
    type: PluginType.panel,
    module: '',
    sort: 0,
  };
  const timeseries: PanelPluginMeta = {
    name: 'Time Series',
    id: 'timeseries',
    info: pluginInfo,
    baseUrl: '',
    type: PluginType.panel,
    module: '',
    sort: 1,
  };

  config.featureToggles = { panelTitleSearch: false };
  const getSpy = jest.spyOn(backendSrv, 'get');

  jest.spyOn(getGrafanaSearcher(), 'getSortOptions').mockResolvedValue([
    {
      label: 'Alphabetically (A–Z)',
      value: 'alpha-asc',
    },
    {
      label: 'Alphabetically (Z–A)',
      value: 'alpha-desc',
    },
  ]);

  const getLibraryPanelsSpy = jest.spyOn(api, 'getLibraryPanels').mockResolvedValue(searchResult);
  const getAllPanelPluginMetaSpy = jest.spyOn(panelUtils, 'getAllPanelPluginMeta').mockReturnValue([graph, timeseries]);

  const props: LibraryPanelsSearchProps = {
    onClick: jest.fn(),
  };

  Object.assign(props, propOverrides);
  const { rerender } = render(<LibraryPanelsSearch {...props} />);

  await waitFor(() => expect(getLibraryPanelsSpy).toHaveBeenCalled());
  expect(getLibraryPanelsSpy).toHaveBeenCalledTimes(1);
  jest.clearAllMocks();

  return { rerender, getLibraryPanelsSpy, getSpy, getAllPanelPluginMetaSpy };
}

describe('LibraryPanelsSearch', () => {
  describe('when mounted with default options', () => {
    it('should show input filter and library panels view', async () => {
      await getTestContext();

      expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
      expect(screen.getByText(/you haven\'t created any library panels yet/i)).toBeInTheDocument();
    });

    describe('and user searches for library panel by name or description', () => {
      it('should call api with correct params', async () => {
        const { getLibraryPanelsSpy } = await getTestContext();

        await userEvent.type(screen.getByPlaceholderText(/search by name/i), 'a');
        await waitFor(() => expect(getLibraryPanelsSpy).toHaveBeenCalled());
        await waitFor(() =>
          expect(getLibraryPanelsSpy).toHaveBeenCalledWith({
            searchString: 'a',
            folderFilterUIDs: [],
            page: 0,
            typeFilter: [],
            perPage: 40,
          })
        );
      });
    });
  });

  describe('when mounted with showSort', () => {
    it('should show input filter and library panels view and sort', async () => {
      await getTestContext({ showSort: true });

      expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
      expect(screen.getByText(/you haven\'t created any library panels yet/i)).toBeInTheDocument();
      expect(screen.getByText(/sort \(default a–z\)/i)).toBeInTheDocument();
    });

    describe('and user changes sorting', () => {
      it('should call api with correct params', async () => {
        const { getLibraryPanelsSpy } = await getTestContext({ showSort: true });

        await userEvent.type(screen.getByText(/sort \(default a–z\)/i), 'Desc{enter}');
        await waitFor(() =>
          expect(getLibraryPanelsSpy).toHaveBeenCalledWith({
            searchString: '',
            sortDirection: 'alpha-desc',
            folderFilterUIDs: [],
            page: 0,
            typeFilter: [],
            perPage: 40,
          })
        );
      });
    });
  });

  describe('when mounted with showPanelFilter', () => {
    it('should show input filter and library panels view and panel filter', async () => {
      await getTestContext({ showPanelFilter: true });

      expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
      expect(screen.getByText(/you haven\'t created any library panels yet/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /panel type filter/i })).toBeInTheDocument();
    });

    describe('and user changes panel filter', () => {
      it('should call api with correct params', async () => {
        const { getLibraryPanelsSpy } = await getTestContext({ showPanelFilter: true });

        await userEvent.type(screen.getByRole('combobox', { name: /panel type filter/i }), 'Graph{enter}');
        await userEvent.type(screen.getByRole('combobox', { name: /panel type filter/i }), 'Time Series{enter}');
        await waitFor(() =>
          expect(getLibraryPanelsSpy).toHaveBeenCalledWith({
            searchString: '',
            folderFilterUIDs: [],
            page: 0,
            typeFilter: ['graph', 'timeseries'],
            perPage: 40,
          })
        );
      });
    });
  });

  describe('when mounted with showPanelFilter', () => {
    it('should show input filter and library panels view and folder filter', async () => {
      await getTestContext({ showFolderFilter: true });

      expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
      expect(screen.getByText(/you haven\'t created any library panels yet/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /folder filter/i })).toBeInTheDocument();
    });

    describe('and user changes folder filter', () => {
      it('should call api with correct params', async () => {
        const { getLibraryPanelsSpy } = await getTestContext(
          { showFolderFilter: true, currentFolderUID: 'wXyZ1234' },
          {
            elements: [
              {
                name: 'Library Panel Name',
                uid: 'uid',
                description: 'Library Panel Description',
                folderUid: '',
                model: { type: 'timeseries', title: 'A title' } as Panel,
                type: 'timeseries',
                version: 1,
                meta: {
                  folderName: 'Dashboards',
                  folderUid: '',
                  connectedDashboards: 0,
                  created: '2021-01-01 12:00:00',
                  createdBy: { id: 1, name: 'Admin', avatarUrl: '' },
                  updated: '2021-01-01 12:00:00',
                  updatedBy: { id: 1, name: 'Admin', avatarUrl: '' },
                },
              },
            ],
            perPage: 40,
            page: 1,
            totalCount: 0,
          }
        );

        await userEvent.click(screen.getByRole('combobox', { name: /folder filter/i }));
        await userEvent.type(screen.getByRole('combobox', { name: /folder filter/i }), 'library', {
          skipClick: true,
        });

        await waitFor(() => {
          expect(getLibraryPanelsSpy).toHaveBeenCalledWith({
            searchString: '',
            folderFilterUIDs: ['wXyZ1234'],
            page: 0,
            typeFilter: [],
            perPage: 40,
          });
        });
      });
    });
  });

  describe('when mounted without showSecondaryActions and there is one panel', () => {
    it('should show correct row and no delete button', async () => {
      await getTestContext(
        {},
        {
          page: 1,
          totalCount: 1,
          perPage: 40,
          elements: [
            {
              name: 'Library Panel Name',
              uid: 'uid',
              description: 'Library Panel Description',
              folderUid: '',
              model: { type: 'timeseries', title: 'A title' } as Panel,
              type: 'timeseries',
              version: 1,
              meta: {
                folderName: 'Dashboards',
                folderUid: '',
                connectedDashboards: 0,
                created: '2021-01-01 12:00:00',
                createdBy: { id: 1, name: 'Admin', avatarUrl: '' },
                updated: '2021-01-01 12:00:00',
                updatedBy: { id: 1, name: 'Admin', avatarUrl: '' },
              },
            },
          ],
        }
      );

      const card = () => screen.getByLabelText(/plugin visualization item time series/i);

      expect(screen.queryByText(/you haven\'t created any library panels yet/i)).not.toBeInTheDocument();
      expect(card()).toBeInTheDocument();
      expect(within(card()).getByText(/library panel name/i)).toBeInTheDocument();
      expect(within(card()).getByText(/library panel description/i)).toBeInTheDocument();
      expect(within(card()).queryByLabelText(/delete button on panel type card/i)).not.toBeInTheDocument();
    });
  });

  describe('when mounted with showSecondaryActions and there is one panel', () => {
    it('should show correct row and delete button', async () => {
      await getTestContext(
        { showSecondaryActions: true },
        {
          page: 1,
          totalCount: 1,
          perPage: 40,
          elements: [
            {
              name: 'Library Panel Name',
              uid: 'uid',
              description: 'Library Panel Description',
              folderUid: '',
              model: { type: 'timeseries', title: 'A title' } as Panel,
              type: 'timeseries',
              version: 1,
              meta: {
                folderName: 'Dashboards',
                folderUid: '',
                connectedDashboards: 0,
                created: '2021-01-01 12:00:00',
                createdBy: { id: 1, name: 'Admin', avatarUrl: '' },
                updated: '2021-01-01 12:00:00',
                updatedBy: { id: 1, name: 'Admin', avatarUrl: '' },
              },
            },
          ],
        }
      );

      const card = () => screen.getByLabelText(/plugin visualization item time series/i);

      expect(screen.queryByText(/you haven\'t created any library panels yet/i)).not.toBeInTheDocument();
      expect(card()).toBeInTheDocument();
      expect(within(card()).getByText(/library panel name/i)).toBeInTheDocument();
      expect(within(card()).getByText(/library panel description/i)).toBeInTheDocument();
      expect(within(card()).getByLabelText(/Delete/i)).toBeInTheDocument();
    });
  });

  describe('when mounted with showSecondaryActions and a specific folder', () => {
    describe('and user deletes a panel', () => {
      it('should call api with correct params', async () => {
        const { getLibraryPanelsSpy } = await getTestContext(
          { showSecondaryActions: true, currentFolderUID: 'wfTJJL5Wz' },
          {
            elements: [
              {
                name: 'Library Panel Name',
                uid: 'uid',
                description: 'Library Panel Description',
                folderUid: 'wfTJJL5Wz',
                model: { type: 'timeseries', title: 'A title' } as Panel,
                type: 'timeseries',
                version: 1,
                meta: {
                  folderName: 'Dashboards',
                  folderUid: '',
                  connectedDashboards: 0,
                  created: '2021-01-01 12:00:00',
                  createdBy: { id: 1, name: 'Admin', avatarUrl: '' },
                  updated: '2021-01-01 12:00:00',
                  updatedBy: { id: 1, name: 'Admin', avatarUrl: '' },
                },
              },
            ],
            perPage: 40,
            page: 1,
            totalCount: 1,
          }
        );

        await userEvent.click(screen.getByLabelText('Delete'));
        await waitFor(() => expect(screen.getByText('Do you want to delete this panel?')).toBeInTheDocument());
        await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]);

        await waitFor(() => {
          expect(getLibraryPanelsSpy).toHaveBeenCalledWith({
            searchString: '',
            folderFilterUIDs: ['wfTJJL5Wz'],
            page: 1,
            typeFilter: [],
            sortDirection: undefined,
            perPage: 40,
          });
        });
      });
    });
  });
});
