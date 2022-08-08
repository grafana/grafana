import { createAsyncThunk } from '@reduxjs/toolkit';

import { DataSourcePluginMeta, DataSourceSettings, locationUtil } from '@grafana/data';
import { isFetchError, locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import * as api from '../api';
import { STATE_PREFIX } from '../constants';
import { nameExits, findNewName } from '../utils';

// Fetch all available datasources
export const fetchAll = createAsyncThunk(`${STATE_PREFIX}/fetchAll`, async (_, thunkApi) => {
  try {
    return await api.getDataSources();
  } catch (error) {
    if (isFetchError(error)) {
      error.isHandled = true;
    }
    return thunkApi.rejectWithValue([]);
  }
});

// Fetch a single data source
export const fetchSingle = createAsyncThunk(`${STATE_PREFIX}/fetchSingle`, async (uid: string, thunkApi) => {
  try {
    return await api.getDataSourceByUid(uid);
  } catch (error) {
    if (isFetchError(error)) {
      error.isHandled = true;
    }
    return thunkApi.rejectWithValue(null);
  }
});

// Creates a new data source
export const create = createAsyncThunk(
  `${STATE_PREFIX}/create`,
  async ({ plugin, editLink }: { plugin: DataSourcePluginMeta; editLink: string }, thunkApi) => {
    const { dispatch, getState } = thunkApi;
    const { dataSources } = getState();
    const isFirstDataSource = dataSources.items.length === 0;
    const newDataSource = {
      name: plugin.name,
      type: plugin.id,
      access: 'proxy',
      isDefault: isFirstDataSource,
    };

    if (nameExits(dataSources, newDataSource.name)) {
      newDataSource.name = findNewName(dataSources, newDataSource.name);
    }

    const result = await api.createDataSource(newDataSource);

    // TODO: let's try to get rid of these somehow
    await getDatasourceSrv().reload();
    await contextSrv.fetchUserPermissions();

    locationService.push(editLink.replace(/:uid/gi, result.datasource.uid));

    return result;
  }
);

export const update = createAsyncThunk(`${STATE_PREFIX}/update`, async (dataSource: DataSourceSettings, thunkApi) => {
  await api.updateDataSource(dataSource);
  await getDatasourceSrv().reload();

  return dataSource;
});

export const remove = createAsyncThunk(`${STATE_PREFIX}/remove`, async (uid: string, thunkApi) => {
  await api.deleteDataSource(uid);
  await getDatasourceSrv().reload();

  // Redirect to the datasources list page
  locationService.push('/datasources');

  return uid;
});

export const test = createAsyncThunk(`${STATE_PREFIX}/test`, async (_, thunkApi) => {
  // return async (dispatch: ThunkDispatch, getState) => {
  //   const dsApi = await dependencies.getDatasourceSrv().get(dataSourceName);
  //   if (!dsApi.testDatasource) {
  //     return;
  //   }
  //   dispatch(testDataSourceStarting());
  //   dependencies.getBackendSrv().withNoBackendCache(async () => {
  //     try {
  //       const result = await dsApi.testDatasource();
  //       dispatch(testDataSourceSucceeded(result));
  //     } catch (err) {
  //       let message: string | undefined;
  //       let details: HealthCheckResultDetails;
  //       if (err instanceof HealthCheckError) {
  //         message = err.message;
  //         details = err.details;
  //       } else if (isFetchError(err)) {
  //         message = err.data.message ?? `HTTP error ${err.statusText}`;
  //       } else if (err instanceof Error) {
  //         message = err.message;
  //       }
  //       dispatch(testDataSourceFailed({ message, details }));
  //     }
  //   });
  // };
});
