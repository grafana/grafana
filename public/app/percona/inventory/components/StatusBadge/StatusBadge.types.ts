import { DbAgent } from 'app/percona/shared/services/services/Services.types';

export interface StatusBadgeProps {
  agents: DbAgent[];
  strippedId: string;
  type: 'services' | 'nodes';
}
