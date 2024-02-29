/*

    const responseObservable = getBackendSrv().fetch<DataQuerySpecResponse>({
        url: BASE_URL
    })
    const response = await lastValueFrom(responseObservable);
    const data = response.data;

 */

import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';

import { GetExploreWorkspacesResponse } from '../types';

export const getExploreWorkspace = async (uid: string) => {
  const responseObservable = getBackendSrv().fetch<GetExploreWorkspacesResponse>({
    url: '/api/exploreworkspaces/',
  });
  const response = await lastValueFrom(responseObservable);
  console.log(response);
};
