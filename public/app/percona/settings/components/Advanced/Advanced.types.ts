import { LoadingCallback } from 'app/percona/settings/Settings.service';

export interface AdvancedProps {
  dataRetention: string;
  telemetryEnabled: boolean;
  sttEnabled: boolean;
  updatesDisabled: boolean;
  dbaasEnabled?: boolean;
  alertingEnabled?: boolean;
  publicAddress?: string;
  updateSettings: (body: any, callback: LoadingCallback, refresh?: boolean) => void;
}
