import React, { useContext } from 'react';

import { GrafanaConfig } from '@grafana/data';

import { LocationService } from '../services/LocationService';
import { BackendSrv } from '../services/backendSrv';

export interface GrafanaContextType {
  backend: BackendSrv;
  location: LocationService;
  config: GrafanaConfig;
}

export const GrafanaContext = React.createContext<GrafanaContextType | undefined>(undefined);

export function useGrafana<TExtra extends object = {}>(): GrafanaContextType & TExtra {
  const context = useContext(GrafanaContext);
  if (!context) {
    throw new Error('No GrafanaContext found');
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return context as GrafanaContextType & TExtra;
}
