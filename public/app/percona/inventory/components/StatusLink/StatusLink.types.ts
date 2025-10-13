import { MonitoringStatus } from '../../Inventory.types';

export interface StatusLinkProps {
  agentsStatus?: MonitoringStatus;
  strippedId: string;
  type: 'services' | 'nodes';
}
