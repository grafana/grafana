import { BaseQueryFn } from '@reduxjs/toolkit/dist/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime/src';

export const backendSrvBaseQuery = (): BaseQueryFn<BackendSrvRequest> => async (requestOptions) => {
  try {
    const { data, ...meta } = await lastValueFrom(getBackendSrv().fetch(requestOptions));

    return { data, meta };
  } catch (error) {
    return { error };
  }
};
