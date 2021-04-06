import { LoadingCallback } from 'app/percona/settings/Settings.service';
import { AlertManagerChangePayload } from '../../Settings.types';

export interface AlertManagerProps {
  alertManagerUrl: string;
  alertManagerRules: string;
  updateSettings: (body: AlertManagerChangePayload, callback: LoadingCallback) => void;
}
