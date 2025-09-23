import { CancelToken } from 'axios';

import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { apiManagement } from 'app/percona/shared/helpers/api';

import { Messages } from './Discovery.messages';
import { RDSInstances } from './Discovery.types';
import { RDSCredentialsForm } from './components/Credentials/Credentials.types';

const { awsNoCredentialsError, noCredentialsError } = Messages;

class DiscoveryService {
  static async discoveryRDS(
    { aws_access_key, aws_secret_key }: RDSCredentialsForm,
    token?: CancelToken,
    disableNotifications = false
  ) {
    return apiManagement
      .post<RDSInstances, RDSCredentialsForm>(
        '/services:discoverRDS',
        {
          aws_access_key,
          aws_secret_key,
        },
        true,
        token
      )
      .catch((e) => {
        if (!disableNotifications) {
          const originalMessage: string = e.response.data?.message ?? 'Unknown error';
          const message = originalMessage.includes(awsNoCredentialsError) ? noCredentialsError : originalMessage;

          appEvents.emit(AppEvents.alertError, [message]);
        }
      });
  }
}

export default DiscoveryService;
