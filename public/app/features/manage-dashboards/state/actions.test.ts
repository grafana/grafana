import { thunkTester } from 'test/core/thunk/thunkTester';

import { setBackendSrv } from '@grafana/runtime';

import { importDashboard } from './actions';
import { DataSourceInput, ImportDashboardDTO, initialImportDashboardState, InputType } from './reducers';

describe('importDashboard', () => {
  it('Should send data source uid', async () => {
    const form: ImportDashboardDTO = {
      title: 'Asda',
      uid: '12',
      gnetId: 'asd',
      constants: [],
      dataSources: [
        {
          id: 1,
          uid: 'ds-uid',
          name: 'ds-name',
          type: 'prometheus',
        } as any,
      ],
      elements: [],
      folder: {
        id: 1,
        title: 'title',
      },
    };

    let postArgs: any;

    setBackendSrv({
      post: (url: string, args: any) => {
        postArgs = args;
        return Promise.resolve({
          importedUrl: '/my/dashboard',
        });
      },
    } as any);

    await thunkTester({
      importDashboard: {
        ...initialImportDashboardState,
        inputs: {
          dataSources: [
            {
              name: 'ds-name',
              pluginId: 'prometheus',
              type: InputType.DataSource,
            },
          ] as DataSourceInput[],
          constants: [],
          libraryPanels: [],
        },
      },
    })
      .givenThunk(importDashboard)
      .whenThunkIsDispatched(form);

    expect(postArgs).toEqual({
      dashboard: {
        title: 'Asda',
        uid: '12',
      },
      folderId: 1,
      inputs: [
        {
          name: 'ds-name',
          pluginId: 'prometheus',
          type: 'datasource',
          value: 'ds-uid',
        },
      ],
      overwrite: true,
    });
  });
});
