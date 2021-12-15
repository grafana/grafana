import { api } from 'app/percona/shared/helpers/api';

import { EmailPayload } from '../../Settings.types';

export const CommunicationService = {
  async testEmailSettings(settings: EmailPayload, email: string): Promise<void> {
    return api.post('/v1/Settings/TestEmailAlertingSettings', { ...settings, email_to: email });
  },
};
