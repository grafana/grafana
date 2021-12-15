import { LoadingCallback } from 'app/percona/settings/Settings.service';
import { AlertingSettings, EmailPayload, SlackPayload } from '../../Settings.types';

export interface CommunicationProps {
  alertingEnabled: boolean;
  alertingSettings: AlertingSettings;
  updateSettings: (body: EmailPayload | SlackPayload, callback: LoadingCallback) => Promise<void>;
}
