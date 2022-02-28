import { LoadingCallback } from 'app/percona/settings/Settings.service';
import { SttCheckIntervalsSettings } from 'app/percona/settings/Settings.types';
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
  sttCheckIntervals: SttCheckIntervalsSettings;
  updateSettings: (body: AdvancedChangePayload, callback: LoadingCallback, onError?: () => void) => void;
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
  rareInterval: string;
  standardInterval: string;
  frequentInterval: string;
}
