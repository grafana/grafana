import { type ControllerRenderProps } from 'react-hook-form';

import { type AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';

/**
 * Build a content key from all alert fingerprints so that changes in alert content
 * (not just count) trigger a recomputation.
 */
export const getAlertGroupsKey = (alertGroups: AlertmanagerGroup[]): string =>
  alertGroups.flatMap((g) => g.alerts.map((a) => a.fingerprint)).join(',');

export const handleContactPointSelect = (
  name: string | undefined | null,
  onChange: ControllerRenderProps['onChange']
) => {
  if (name === null) {
    return onChange(null);
  }

  if (!name) {
    return onChange('');
  }

  return onChange(name);
};
