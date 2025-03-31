import { useState } from 'react';

import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Button, Column, EmptyState, InteractiveTable, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { GrafanaRuleDefinition, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { trackDeletedRuleRestoreFail, trackDeletedRuleRestoreSuccess } from '../../../Analytics';
import { UpdatedByUser } from '../../rule-viewer/tabs/version-history/UpdatedBy';

import { ConfirmRestoreDeletedRuleModal } from './ConfirmRestoreDeletedRuleModal';

const DELETED_RULES_PAGE_SIZE = 30;

interface DeletedRulesProps {
  deletedRules: Array<RulerGrafanaRuleDTO<GrafanaRuleDefinition>>;
}
export function DeletedRules({ deletedRules }: DeletedRulesProps) {
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreRule, setRestoreRule] = useState<RulerGrafanaRuleDTO | undefined>();

  const unknown = t('alerting.deleted-rules.unknown', 'Unknown');

  if (deletedRules.length === 0) {
    return (
      <EmptyState
        message={t('alerting.deleted-rules.empty-state-title', 'No recently deleted rules found')}
        variant="not-found"
      />
    );
  }

  const showConfirmation = (id: string) => {
    const ruleTorestore = deletedRules.find((rule) => getRowId(rule.grafana_alert) === id);
    if (!ruleTorestore) {
      return;
    }

    setConfirmRestore(true);
    setRestoreRule(ruleTorestore);
  };

  const hideConfirmation = () => {
    setConfirmRestore(false);
  };

  const columns: Array<Column<(typeof deletedRules)[0]>> = [
    {
      id: 'createdBy',
      header: t('alerting.deleted-rules.table.updatedBy', 'Deleted By'),
      disableGrow: true,
      cell: ({ row }) => {
        return <UpdatedByUser user={row.original.grafana_alert.updated_by} />;
      },
    },
    {
      id: 'title',
      header: t('alerting.deleted-rules.table.title', 'Title'),
      disableGrow: true,
      cell: ({ row }) => {
        return row.original.grafana_alert.title;
      },
    },
    {
      id: 'folder',
      header: t('alerting.deleted-rules.table.folder', 'Folder'),
      disableGrow: true,
      cell: ({ row }) => {
        return row.original.grafana_alert.namespace_uid;
      },
    },
    {
      id: 'group',
      header: t('alerting.deleted-rules.table.group', 'Group'),
      disableGrow: true,
      cell: ({ row }) => {
        return row.original.grafana_alert.rule_group;
      },
    },
    {
      id: 'created',
      header: t('alerting.deleted-rules.table.updated', 'Deletion Date'),
      disableGrow: true,
      cell: ({ row }) => {
        const value = row.original.grafana_alert.updated;
        if (!value) {
          return unknown;
        }
        return dateTimeFormat(value) + ' (' + dateTimeFormatTimeAgo(value) + ')';
      },
    },
    {
      id: 'actions',
      disableGrow: true,
      cell: ({ row }) => {
        return (
          <Stack direction="row" alignItems="center" justifyContent="flex-end">
            <Button
              variant="secondary"
              size="sm"
              icon="history"
              onClick={() => {
                showConfirmation(getRowId(row.original.grafana_alert));
              }}
            >
              <Trans i18nKey="alerting.deleted-rules.restore">Restore</Trans>
            </Button>
          </Stack>
        );
      },
    },
  ];

  return (
    <>
      <InteractiveTable
        pageSize={DELETED_RULES_PAGE_SIZE}
        columns={columns}
        data={deletedRules}
        getRowId={(row) => {
          return getRowId(row.grafana_alert);
        }}
      />
      <ConfirmRestoreDeletedRuleModal
        ruleToRestore={restoreRule}
        isOpen={confirmRestore}
        onDismiss={hideConfirmation}
        onRestoreSucess={trackDeletedRuleRestoreSuccess}
        onRestoreError={trackDeletedRuleRestoreFail}
      />
    </>
  );
}

function getRowId(row: GrafanaRuleDefinition) {
  return row.guid || row.uid;
}
