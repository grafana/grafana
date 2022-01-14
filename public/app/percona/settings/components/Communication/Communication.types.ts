import { LoadingCallback } from 'app/percona/settings/Settings.service';
import { AlertingSettings } from '../../Settings.types';

export interface CommunicationProps {
  alertingEnabled: boolean;
  alertingSettings: AlertingSettings;
  updateSettings: (body: any, callback: LoadingCallback) => void;
}
