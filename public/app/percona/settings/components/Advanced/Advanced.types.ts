import { LoadingCallback } from 'app/percona/settings/Settings.service';
import { AdvancedChangePayload } from '../../Settings.types';

export interface AdvancedProps {
  dataRetention: string;
  telemetryEnabled: boolean;
  sttEnabled: boolean;
  updatesDisabled: boolean;
  dbaasEnabled?: boolean;
  backupEnabled: boolean;
  alertingEnabled?: boolean;
  azureDiscoverEnabled?: boolean;
  publicAddress?: string;
  updateSettings: (body: AdvancedChangePayload, callback: LoadingCallback, refresh?: boolean) => void;
}

export interface AdvancedFormProps {
  retention: number | string;
  telemetry: boolean;
  updates: boolean;
  backup: boolean;
  stt: boolean;
  dbaas?: boolean;
  publicAddress?: string;
  alerting?: boolean;
  azureDiscover?: boolean;
}
