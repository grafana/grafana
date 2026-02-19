import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Button, Checkbox, Column, InteractiveTable, Stack, Text, useStyles2 } from '@grafana/ui';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { computeVersionDiff } from 'app/features/alerting/unified/utils/diff';
import { RuleIdentifier } from 'app/types/unified-alerting';
import { GrafanaRuleDefinition, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { ConfirmVersionRestoreModal } from './ConfirmVersionRestoreModal';
import { UpdatedByUser } from './UpdatedBy';

const VERSIONS_PAGE_SIZE = 20;

export interface VersionHistoryTableProps {
  onVersionsChecked(id: string): void;
  onCompareSingleVersion(rule: RulerGrafanaRuleDTO<GrafanaRuleDefinition>): void;
  ruleVersions: Array<RulerGrafanaRuleDTO<GrafanaRuleDefinition>>;
  disableSelection: boolean;
  checkedVersions: Set<string>;
  onRestoreSuccess: () => void;
  onRestoreError: (error: Error) => void;
  canRestore: boolean;
}
export function VersionHistoryTable({
  onVersionsChecked,
  onCompareSingleVersion,
  ruleVersions,
  disableSelection,
  checkedVersions,
  onRestoreSuccess,
  onRestoreError,
  canRestore,
}: VersionHistoryTableProps) {
  const styles = useStyles2(getStyles);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [ruleToRestore, setRuleToRestore] = useState<RulerGrafanaRuleDTO<GrafanaRuleDefinition>>();
  const ruleToRestoreUid = ruleToRestore?.grafana_alert?.uid ?? '';
  const ruleIdentifier: RuleIdentifier = useMemo(
    () => ({ ruleSourceName: GRAFANA_RULES_SOURCE_NAME, uid: ruleToRestoreUid }),
    [ruleToRestoreUid]
  );

  const hasAnyNotes = useMemo(() => ruleVersions.some((v) => v.grafana_alert.message), [ruleVersions]);

  const showConfirmation = (ruleToRestore: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) => {
    setShowConfirmModal(true);
    setRuleToRestore(ruleToRestore);
  };

  const hideConfirmation = () => {
    setShowConfirmModal(false);
  };

  const unknown = t('alerting.alertVersionHistory.unknown', 'Unknown');

  const notesColumn: Column<RulerGrafanaRuleDTO<GrafanaRuleDefinition>> = {
    id: 'notes',
    header: t('core.versionHistory.table.notes', 'Notes'),
    cell: ({ row }) => {
      const message = row.original.grafana_alert.message;
      return message || null;
    },
  };

  const columns: Array<Column<RulerGrafanaRuleDTO<GrafanaRuleDefinition>>> = [
    {
      disableGrow: true,
      id: 'id',
      header: t('core.versionHistory.table.version', 'Version'),
      cell: ({ row }) => {
        const id = String(row.original.grafana_alert.version);
        const thisValue = checkedVersions.has(String(id ?? false)) ?? false;
        return (
          <Stack direction="row">
            <Checkbox
              label={id}
              checked={thisValue}
              disabled={disableSelection && !thisValue}
              onChange={() => {
                onVersionsChecked(id);
              }}
            />
          </Stack>
        );
      },
    },
    {
      id: 'createdBy',
      header: t('core.versionHistory.table.updatedBy', 'Updated By'),
      disableGrow: true,
      cell: ({ row }) => {
        return <UpdatedByUser user={row.original.grafana_alert.updated_by} />;
      },
    },
    {
      id: 'created',
      header: t('core.versionHistory.table.updated', 'Date'),
      disableGrow: true,
      cell: ({ row }) => {
        const value = row.original.grafana_alert.updated;
        if (!value) {
          return unknown;
        }
        return (
          <span className={styles.nowrap}>{dateTimeFormat(value) + ' (' + dateTimeFormatTimeAgo(value) + ')'}</span>
        );
      },
    },
    ...(hasAnyNotes ? [notesColumn] : []),
    {
      id: 'diff',
      disableGrow: true,
      cell: ({ rows, row }) => {
        const isLastItem = row.index === ruleVersions.length - 1;

        const prevVersion = isLastItem ? {} : rows[row.index + 1]?.original;
        const currentVersion = row.original;
        const diff = computeVersionDiff(prevVersion, currentVersion);

        const added = `+${diff.added}`;
        const removed = `-${diff.removed}`;
        return (
          <Stack alignItems="baseline" gap={0.5}>
            <Text color="success" variant="bodySmall">
              {added}
            </Text>
            <Text color="error" variant="bodySmall">
              {removed}
            </Text>
          </Stack>
        );
      },
    },
    {
      id: 'actions',
      disableGrow: true,
      cell: ({ row }) => {
        const isFirstItem = row.index === 0;
        const compareWithLatest = t('alerting.alertVersionHistory.compare-with-latest', 'Compare with latest version');

        return (
          <Stack direction="row" alignItems="center" justifyContent="flex-end">
            {isFirstItem && <Badge text={t('alerting.alertVersionHistory.latest', 'Latest')} color="blue" />}
            {!isFirstItem && canRestore && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="code-branch"
                  onClick={() => {
                    onCompareSingleVersion(row.original);
                  }}
                  tooltip={compareWithLatest}
                >
                  <Trans i18nKey="alerting.alertVersionHistory.compare">Compare</Trans>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="history"
                  onClick={() => {
                    row.original.grafana_alert.version && showConfirmation(row.original);
                  }}
                >
                  <Trans i18nKey="alerting.alertVersionHistory.restore">Restore</Trans>
                </Button>
              </>
            )}
          </Stack>
        );
      },
    },
  ];

  return (
    <>
      <InteractiveTable
        pageSize={VERSIONS_PAGE_SIZE}
        columns={columns}
        data={ruleVersions}
        getRowId={(row) => `${row.grafana_alert.version}`}
      />
      <ConfirmVersionRestoreModal
        ruleIdentifier={ruleIdentifier}
        baseVersion={ruleVersions[0]}
        versionToRestore={ruleToRestore}
        isOpen={showConfirmModal}
        onDismiss={hideConfirmation}
        onRestoreSucess={onRestoreSuccess}
        onRestoreError={onRestoreError}
      />
    </>
  );
}

const getStyles = () => ({
  nowrap: css({
    whiteSpace: 'nowrap',
  }),
});
