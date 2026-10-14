import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type Column } from '@grafana/ui';

import { DeletedRuleReviewDrawer } from '../../recently-deleted/DeletedRuleReviewDrawer';
import { DeletedRulesTable } from '../../recently-deleted/DeletedRulesTable';
import { useTrackDeletedRulesPage } from '../../recently-deleted/useTrackDeletedRulesPage';

import { useDeletedRecordingRules } from './recordingRulesTrash';

/**
 * Recently deleted page body for Grafana-managed Recording rules.
 * FE-platform mounts this inside the routed page/tab shell - this component owns only the data
 * fetch, table, and Review drawer.
 */
export function RecordingRulesRecentlyDeleted() {
  const deleted = useDeletedRecordingRules();
  const extraColumns = useExtraColumns();
  useTrackDeletedRulesPage('recording', deleted);

  return (
    <DeletedRulesTable
      deleted={deleted}
      renderReview={(rule, onClose) => <DeletedRuleReviewDrawer kind="recording" rule={rule} onClose={onClose} />}
      extraColumns={extraColumns}
    />
  );
}

function TargetDataSourceCell({ uid }: { uid: string }) {
  const { settings } = useDataSourceInstanceSettings(uid);
  return <>{settings?.name ?? uid}</>;
}

function useExtraColumns(): Array<Column<RecordingRule>> {
  return [
    {
      id: 'metric',
      header: t('alerting.deleted-rules.table.recorded-metric', 'Recorded metric'),
      cell: ({ row }) => row.original.spec.metric,
    },
    {
      id: 'targetDataSource',
      header: t('alerting.deleted-rules.table.target-data-source', 'Target data source'),
      cell: ({ row }) => <TargetDataSourceCell uid={row.original.spec.targetDatasourceUID} />,
    },
  ];
}
