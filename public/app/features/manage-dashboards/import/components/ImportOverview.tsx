import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { isDashboardV1Spec, isDashboardV2Spec } from 'app/features/dashboard/api/utils';

import { type DashboardInputs, type DashboardSource } from '../../types';

import { ImportOverviewV1 } from './ImportOverviewV1';
import { ImportOverviewV2 } from './ImportOverviewV2';

type Props = {
  dashboard: unknown;
  dashboardUid?: string;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  onCancel: () => void;
};

export function ImportOverview({ dashboard, dashboardUid, inputs, meta, source, onCancel }: Props) {
  const searchObj = locationService.getSearchObject();
  const folderUid = searchObj.folderUid ? String(searchObj.folderUid) : '';

  if (isDashboardV2Spec(dashboard)) {
    return (
      <ImportOverviewV2
        dashboard={dashboard}
        dashboardUid={dashboardUid}
        inputs={inputs}
        meta={meta}
        source={source}
        folderUid={folderUid}
        onCancel={onCancel}
      />
    );
  }

  if (isDashboardV1Spec(dashboard)) {
    return (
      <ImportOverviewV1
        dashboard={dashboard}
        inputs={inputs}
        meta={meta}
        source={source}
        folderUid={folderUid}
        onCancel={onCancel}
      />
    );
  }

  return (
    <Alert
      severity="error"
      title={t('manage-dashboards.import-overview.invalid-schema-title', 'Invalid or unknown dashboard schema')}
      onRemove={onCancel}
      buttonContent={
        <Trans i18nKey="manage-dashboards.import-overview.invalid-schema-action">Try another dashboard</Trans>
      }
    >
      <Trans i18nKey="manage-dashboards.import-overview.invalid-schema-body">
        The dashboard could not be imported because its schema is not a recognized version.
      </Trans>
    </Alert>
  );
}
