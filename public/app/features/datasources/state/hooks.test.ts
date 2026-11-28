import { getWrapper, renderHook } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';
import { type StoreState } from 'app/types/store';

import { getMockDataSource } from '../mocks/dataSourcesMocks';

import { useDataSourceRights } from './hooks';
import { initialDataSourceSettingsState, initialState } from './reducers';

const orphanedDataSource = { uid: 'orphan', name: 'Orphan', pluginType: 'not-installed' };

function renderRights(uid: string, storeState: Partial<StoreState>) {
  const wrapper = getWrapper({ store: configureStore(storeState), renderWithRouter: false });
  return renderHook(() => useDataSourceRights(uid), { wrapper }).result.current;
}

describe('useDataSourceRights', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('takes the rights of a loaded data source from its access control metadata', () => {
    const dataSource = getMockDataSource({
      uid: 'abc',
      readOnly: true,
      accessControl: { [AccessControlAction.DataSourcesDelete]: true },
    });

    const rights = renderRights('abc', {
      dataSources: { ...initialState, dataSource, dataSources: [dataSource] },
      dataSourceSettings: initialDataSourceSettingsState,
    });

    expect(rights).toEqual({ readOnly: true, hasWriteRights: false, hasDeleteRights: true });
  });

  // The data source of a plugin that is not installed never loads, so it has no access control metadata.
  it('takes the delete right of a data source whose plugin is not installed from the user permissions', () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => action === AccessControlAction.DataSourcesDelete);

    const rights = renderRights('orphan', {
      dataSources: initialState,
      dataSourceSettings: { ...initialDataSourceSettingsState, orphanedDataSource },
    });

    expect(rights).toEqual({ readOnly: false, hasWriteRights: false, hasDeleteRights: true });
  });

  it('denies deleting a data source whose plugin is not installed without the delete permission', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    const rights = renderRights('orphan', {
      dataSources: initialState,
      dataSourceSettings: { ...initialDataSourceSettingsState, orphanedDataSource },
    });

    expect(rights.hasDeleteRights).toBe(false);
  });
});
