import React from 'react';

import { LocationService } from './LocationService';
import { BackendSrv } from './backendSrv';

interface GrafanaContextType {
  services?: GrafanaServices;
}

interface GrafanaServices {
  backend: BackendSrv;
  location: LocationService;
}

export const GrafanaContext = React.createContext(createGrafanaContext());

function createGrafanaContext(): GrafanaContextType {
  return {};
}
