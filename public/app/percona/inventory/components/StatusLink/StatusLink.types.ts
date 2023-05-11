import { DbAgent } from 'app/percona/shared/services/services/Services.types';

export interface StatusLinkProps {
  agents: DbAgent[];
  strippedId: string;
  type: 'services' | 'nodes';
}
