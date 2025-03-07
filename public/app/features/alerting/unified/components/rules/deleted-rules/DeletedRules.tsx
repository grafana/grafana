import { useState } from 'react';

import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Alert, Button, Column, InteractiveTable, LoadingPlaceholder, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { GrafanaRuleDefinition, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../../api/alertRuleApi';
import { GRAFANA_RULER_CONFIG } from '../../../api/featureDiscoveryApi';
import { stringifyErrorLike } from '../../../utils/misc';
import { isGrafanaRulerRule } from '../../../utils/rules';
import { UpdatedByUser } from '../../rule-viewer/tabs/version-history/UpdatedBy';

import { ConfirmRestoreDeletedRuleModal } from './ConfirmRestoreDeletedRuleModal';

export const DELETED_RULES_PAGE_SIZE = 30;

export function DeletedRules() {
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreRule, setRestoreRule] = useState<RulerRuleDTO | undefined>();

  const {
    currentData = [],
    isLoading,
    error,
  } = alertRuleApi.endpoints.getDeletedRules.useQuery({
    rulerConfig: GRAFANA_RULER_CONFIG,
    filter: {}, // todo: add filters, and limit?????
  });

  const unknown = t('alerting.deletedRules.unknown', 'Unknown');

  const values = Object.values(currentData);
  const deletedRules = values.length > 0 ? values[0][0]?.rules : [];

  const showConfirmation = (id: string) => {
    const ruleTorestore = deletedRules.find((rule) => isGrafanaRulerRule(rule) && getRowId(rule.grafana_alert) === id);
    if (!ruleTorestore) {
      return;
    }

    setConfirmRestore(true);
    setRestoreRule(ruleTorestore);
  };

  const hideConfirmation = () => {
    setConfirmRestore(false);
  };

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.common.loading', 'Loading...')} />;
  }

  if (error) {
    return (
      <Alert title={t('alerting.deletedRules.errorloading', 'Failed to load alert deleted rules')}>
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  const columns: Array<Column<(typeof deletedRules)[0]>> = [
    {
      id: 'createdBy',
      header: t('alerting.deletedRules.table.updatedBy', 'Deleted By'),
      disableGrow: true,
      cell: ({ row }) => {
        if (!isGrafanaRulerRule(row.original)) {
          return unknown;
        }
        return <UpdatedByUser user={row.original.grafana_alert.updated_by} />;
      },
    },
    {
      id: 'title',
      header: t('alerting.deletedRules.table.title', 'Title'),
      disableGrow: true,
      cell: ({ row }) => {
        if (!isGrafanaRulerRule(row.original)) {
          return unknown;
        }
        return row.original.grafana_alert.title;
      },
    },
    {
      id: 'folder',
      header: t('alerting.deletedRules.table.folder', 'Folder'),
      disableGrow: true,
      cell: ({ row }) => {
        if (!isGrafanaRulerRule(row.original)) {
          return unknown;
        }
        return row.original.grafana_alert.namespace_uid;
      },
    },
    {
      id: 'group',
      header: t('alerting.deletedRules.table.group', 'Group'),
      disableGrow: true,
      cell: ({ row }) => {
        if (!isGrafanaRulerRule(row.original)) {
          return unknown;
        }
        return row.original.grafana_alert.rule_group;
      },
    },
    {
      id: 'created',
      header: t('alerting.deletedRules.table.updated', 'Deletion Date'),
      disableGrow: true,
      cell: ({ row }) => {
        if (!isGrafanaRulerRule(row.original)) {
          return unknown;
        }
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
                showConfirmation(isGrafanaRulerRule(row.original) ? getRowId(row.original.grafana_alert) : 'unknown');
              }}
            >
              <Trans i18nKey="alerting.deletedRules.restore">Restore</Trans>
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
          if (!isGrafanaRulerRule(row)) {
            return 'unknown';
          }
          return getRowId(row.grafana_alert);
        }}
      />
      <ConfirmRestoreDeletedRuleModal
        ruleToRestore={restoreRule}
        isOpen={confirmRestore}
        onDismiss={hideConfirmation}
        onRestoreSucess={() => {}}
        onRestoreError={() => {}}
      />
    </>
  );
}

function getRowId(row: GrafanaRuleDefinition) {
  return `${row.namespace_uid}${row.namespace_uid}${row.title}${row.version}`;
}
