import { BaseQueryFn } from '@reduxjs/toolkit/src/query/baseQueryTypes';
import { lastValueFrom } from 'rxjs';

import { getBackendSrv, isFetchError } from '../../backendSrv';

import { DataQuerySpecResponse } from './types';

export const BASE_URL = '/apis/peakq.grafana.app/v0alpha1/namespaces/default/querytemplates/';

export const baseQuery: BaseQueryFn<void, DataQuerySpecResponse, Error> = async () => {
  try {
    const responseObservable = getBackendSrv().fetch<DataQuerySpecResponse>({
      url: BASE_URL,
      showErrorAlert: true,
    });
    return await lastValueFrom(responseObservable);
  } catch (error) {
    if (isFetchError(error)) {
      return { error: new Error(error.data.message) };
    } else if (error instanceof Error) {
      return { error };
    } else {
      return { error: new Error('Unknown error') };
    }
  }
};
