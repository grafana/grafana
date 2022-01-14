import { createContext } from 'react';
import { AlertsReload } from 'app/percona/check/types';

export const AlertsReloadContext = createContext<AlertsReload>({ fetchAlerts: async () => {} });
