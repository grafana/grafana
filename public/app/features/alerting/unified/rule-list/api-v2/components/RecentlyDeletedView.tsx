import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2, dateTimeFormat } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, type Column, EmptyState, Icon, InteractiveTable, Stack, useStyles2 } from '@grafana/ui';
import { type GrafanaRuleDefinition, type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { trackDeletedRuleRestoreFail, trackDeletedRuleRestoreSuccess } from '../../../Analytics';
import { alertRuleApi } from '../../../api/alertRuleApi';
import { UpdatedByUser } from '../../../components/rule-viewer/tabs/version-history/UpdatedBy';
import { ConfirmDeletedPermanentlyModal } from '../../../components/rules/deleted-rules/ConfirmDeletePermanantlyModal';
import { ConfirmRestoreDeletedRuleModal } from '../../../components/rules/deleted-rules/ConfirmRestoreDeletedRuleModal';
import { shouldAllowPermanentlyDeletingRules } from '../../../featureToggles';

type DeletedRule = RulerGrafanaRuleDTO<GrafanaRuleDefinition>;

const PAGE_SIZE = 30;

export function RecentlyDeletedView() {
  const styles = useStyles2(getStyles);
  const { data, isLoading } = alertRuleApi.endpoints.getDeletedRules.useQuery({});

  const [restoreRule, setRestoreRule] = useState<DeletedRule | undefined>();
  const [guidToDelete, setGuidToDelete] = useState<string | undefined>();

  const allowPermanent = shouldAllowPermanentlyDeletingRules();

  if (isLoading) {
    return (
      <div className={styles.wrapper}>
        <Trans i18nKey="alerting.rule-list-v2.loading">Loading…</Trans>
      </div>
    );
  }

  const rules = data ?? [];

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>
        <Trans i18nKey="alerting.rule-list-v2.deleted.title">Recently deleted</Trans>
      </h2>
      <p className={styles.subtitle}>
        <Trans i18nKey="alerting.rule-list-v2.deleted.subtitle">Soft-deleted rules. Restore within 30 days.</Trans>
      </p>

      {rules.length === 0 ? (
        <EmptyState
          message={t('alerting.rule-list-v2.deleted.empty', 'No recently deleted rules found')}
          variant="not-found"
        />
      ) : (
        <InteractiveTable
          pageSize={PAGE_SIZE}
          columns={buildColumns(allowPermanent, setRestoreRule, setGuidToDelete)}
          data={rules}
          getRowId={(row) => row.grafana_alert.guid || row.grafana_alert.uid}
        />
      )}

      <ConfirmRestoreDeletedRuleModal
        ruleToRestore={restoreRule}
        isOpen={Boolean(restoreRule)}
        onDismiss={() => setRestoreRule(undefined)}
        onRestoreSucess={trackDeletedRuleRestoreSuccess}
        onRestoreError={trackDeletedRuleRestoreFail}
      />
      <ConfirmDeletedPermanentlyModal
        guid={guidToDelete}
        isOpen={guidToDelete !== undefined}
        onDismiss={() => setGuidToDelete(undefined)}
      />
    </div>
  );
}

function buildColumns(
  allowPermanent: boolean,
  setRestoreRule: (r: DeletedRule) => void,
  setGuidToDelete: (g: string) => void
): Array<Column<DeletedRule>> {
  return [
    {
      id: 'name',
      header: t('alerting.rule-list-v2.deleted.column-name', 'NAME'),
      cell: ({ row }) => (
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Icon name="bell" />
          <code>{row.original.grafana_alert.title}</code>
        </Stack>
      ),
    },
    {
      id: 'location',
      header: t('alerting.rule-list-v2.deleted.column-location', 'LOCATION'),
      cell: ({ row }) =>
        `${row.original.grafana_alert.namespace_uid ?? '—'} / ${row.original.grafana_alert.rule_group ?? '—'}`,
    },
    {
      id: 'deletedAt',
      header: t('alerting.rule-list-v2.deleted.column-deleted-at', 'DELETED AT'),
      cell: ({ row }) => {
        const value = row.original.grafana_alert.updated;
        return value ? dateTimeFormat(value) : '—';
      },
    },
    {
      id: 'deletedBy',
      header: t('alerting.rule-list-v2.deleted.column-deleted-by', 'DELETED BY'),
      cell: ({ row }) => <UpdatedByUser user={row.original.grafana_alert.updated_by} />,
    },
    {
      id: 'actions',
      header: '',
      disableGrow: true,
      cell: ({ row }) => (
        <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.5}>
          <Button size="sm" variant="secondary" icon="history" onClick={() => setRestoreRule(row.original)}>
            <Trans i18nKey="alerting.rule-list-v2.deleted.restore">Restore</Trans>
          </Button>
          {allowPermanent && (
            <Button
              size="sm"
              variant="destructive"
              icon="trash-alt"
              onClick={() => {
                const guid = row.original.grafana_alert.guid;
                if (guid) {
                  setGuidToDelete(guid);
                }
              }}
            >
              <Trans i18nKey="alerting.rule-list-v2.deleted.delete-permanently">Delete permanently</Trans>
            </Button>
          )}
        </Stack>
      ),
    },
  ];
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      padding: theme.spacing(1, 2),
      flex: 1,
      minWidth: 0,
    }),
    title: css({
      margin: 0,
      marginBottom: theme.spacing(0.5),
      fontSize: theme.typography.h3.fontSize,
    }),
    subtitle: css({
      margin: 0,
      marginBottom: theme.spacing(2),
      color: theme.colors.text.secondary,
    }),
  };
}
