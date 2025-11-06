import { BadgeColor, IconName } from '@grafana/ui';
import { SyncStatus } from 'app/api/clients/provisioning/v0alpha1';

export interface RepositoryStatus {
  color: BadgeColor;
  text: string;
  icon: IconName;
  tooltip?: string;
}

export const getStatusColor = (state?: SyncStatus['state']) => {
  switch (state) {
    case 'success':
      return 'green';
    case 'working':
      return 'blue';
    case 'warning':
      return 'orange';
    case 'pending':
      return 'darkgrey';
    case 'error':
      return 'red';
    default:
      return 'darkgrey';
  }
};

export const getStatusIcon = (state?: SyncStatus['state']): IconName => {
  switch (state) {
    case 'success':
      return 'check';
    case 'working':
      return 'spinner'
    case 'warning':
      return 'exclamation-triangle';
    case 'pending':
      return 'spinner';
    case 'error':
      return 'exclamation-triangle';
    default:
      return 'exclamation-triangle';
  }
};
