import { apiManagement } from 'app/percona/shared/helpers/api';
import { CancelToken } from 'axios';
import { CredentialsForm } from './components/Credentials/Credentials.types';
import { RDSInstances } from './Discovery.types';

class DiscoveryService {
  static async discoveryRDS({ aws_access_key, aws_secret_key }: CredentialsForm, token?: CancelToken) {
    return apiManagement.post<RDSInstances, CredentialsForm>(
      '/RDS/Discover',
      {
        aws_access_key,
        aws_secret_key,
      },
      false,
      token
    );
  }
}

export default DiscoveryService;
