import { GrafanaContextType, useGrafana } from '@grafana/runtime';

import { AppChromeService } from '../components/AppChrome/AppChromeService';

export interface GrafanaContextWithInternals extends GrafanaContextType {
  chrome: AppChromeService;
}

export function useGrafanaInternal(): GrafanaContextWithInternals {
  return useGrafana<GrafanaContextWithInternals>();
}
