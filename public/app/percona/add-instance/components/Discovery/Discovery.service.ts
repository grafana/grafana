import { apiManagement } from 'app/percona/shared/helpers/api';

import { RDSInstances } from './Discovery.types';
import { CredentialsForm } from './components/Credentials/Credentials.types';

class DiscoveryService {
  static async discoveryRDS({ aws_access_key, aws_secret_key }: CredentialsForm) {
    return apiManagement.post<RDSInstances, CredentialsForm>('/RDS/Discover', {
      aws_access_key,
      aws_secret_key,
    });
  }
}

export default DiscoveryService;
