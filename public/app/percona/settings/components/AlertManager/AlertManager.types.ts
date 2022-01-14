import { LoadingCallback } from 'app/percona/settings/Settings.service';

export interface AlertManagerProps {
  alertManagerUrl: string;
  alertManagerRules: string;
  updateSettings: (body: any, callback: LoadingCallback) => void;
}
