import { t } from '@grafana/i18n';

export const getReadOnlyTooltipText = () =>
  t(
    'provisioning.read-only-tooltip',
    'This folder is read-only and provisioned through Git. To make any changes in the folder, update the connected repository. To modify the folder settings go to Administration > Provisioning > Repositories.'
  );
