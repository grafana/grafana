import { thunkTester } from 'test/core/thunk/thunkTester';

import { setBackendSrv } from '@grafana/runtime';

import { validateDashboardJson } from '../utils/validation';

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

describe('validateDashboardJson', () => {
  it('Should return true if correct json', async () => {
    const json_import_correct_format = '{"title": "Correct Format", "tags": ["tag1", "tag2"], "schemaVersion": 36}';
    const validate_dashboard_json_correct_format = await validateDashboardJson(json_import_correct_format);
    expect(validate_dashboard_json_correct_format).toBe(true);
  });
  it('Should not return true if nested tags', async () => {
    const json_import_nested_tags =
      '{"title": "Nested tags","tags": ["tag1", "tag2", ["nestedTag1", "nestedTag2"]],"schemaVersion": 36}';
    const validate_dashboard_json_nested_tags = await validateDashboardJson(json_import_nested_tags);
    expect(validate_dashboard_json_nested_tags).toBe('error: tags expected Array of Strings');
  });
  it('Should not return true if not an array', async () => {
    const json_import_not_array = '{"title": "Not Array","tags": "tag1","schemaVersion":36}';
    const validate_dashboard_json_not_array = await validateDashboardJson(json_import_not_array);
    expect(validate_dashboard_json_not_array).toBe('error: tags expected Array');
  });
});
