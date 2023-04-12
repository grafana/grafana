import { DbServiceAgent } from 'app/percona/shared/services/services/Services.types';

export interface StatusLinkProps {
  agents: DbServiceAgent[];
  strippedServiceId: string;
}
