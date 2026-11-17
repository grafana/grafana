import { type AriaRole } from 'react';

import { type IconName } from '../../types/icon';

import { type AlertVariant } from './Alert';

export const rolesBySeverity: Record<AlertVariant, AriaRole> = {
  error: 'alert',
  warning: 'alert',
  info: 'status',
  success: 'status',
};

export const getIconFromSeverity = (severity: AlertVariant): IconName => {
  switch (severity) {
    case 'error':
      return 'exclamation-circle';
    case 'warning':
      return 'exclamation-triangle';
    case 'info':
      return 'info-circle';
    case 'success':
      return 'check';
  }
};
