import { useState } from 'react';

import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Badge, Button, Checkbox, Column, ConfirmModal, InteractiveTable, Stack, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { computeVersionDiff } from 'app/features/alerting/unified/utils/diff';
import { DiffGroup } from 'app/features/dashboard-scene/settings/version-history/DiffGroup';
import { Diffs, jsonDiff } from 'app/features/dashboard-scene/settings/version-history/utils';
import { GrafanaRuleDefinition, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { UpdatedByUser } from './UpdatedBy';

const VERSIONS_PAGE_SIZE = 20;

export function VersionHistoryTable({
  onVersionsChecked,
  ruleVersions,
  disableSelection,
  checkedVersions,
}: {
  onVersionsChecked(id: string): void;
  ruleVersions: Array<RulerGrafanaRuleDTO<GrafanaRuleDefinition>>;
  disableSelection: boolean;
  checkedVersions: Set<string>;
}) {
  //----> restore code : no need to review as it's behind a feature flag
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreDiff, setRestoreDiff] = useState<Diffs | undefined>();

  const showConfirmation = (id: string) => {
    const currentVersion = ruleVersions[0];
    const restoreVersion = ruleVersions.find((rule) => String(rule.grafana_alert.version) === id);
    if (!restoreVersion) {
      return;
    }

    setConfirmRestore(true);
    setRestoreDiff(jsonDiff(currentVersion, restoreVersion));
  };

  const hideConfirmation = () => {
    setConfirmRestore(false);
  };
  //----> end of restore code
  const unknown = t('alerting.alertVersionHistory.unknown', 'Unknown');

  const columns: Array<Column<(typeof ruleVersions)[0]>> = [
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
        return dateTimeFormat(value) + ' (' + dateTimeFormatTimeAgo(value) + ')';
      },
    },
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

        return (
          <Stack direction="row" alignItems="center" justifyContent="flex-end">
            {isFirstItem ? (
              <Badge text={t('alerting.alertVersionHistory.latest', 'Latest')} color="blue" />
            ) : config.featureToggles.alertingRuleVersionHistoryRestore ? (
              <Button
                variant="secondary"
                size="sm"
                icon="history"
                onClick={() => {
                  showConfirmation(row.values.id);
                }}
              >
                <Trans i18nKey="alerting.alertVersionHistory.restore">Restore</Trans>
              </Button>
            ) : null}
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
      {/* ---------------------> restore code: no need to review for this pr as it's behind a feature flag */}
      <ConfirmModal
        isOpen={confirmRestore}
        title={t('alerting.alertVersionHistory.restore-modal.title', 'Restore Version')}
        body={
          <Stack direction="column" gap={2}>
            <Trans i18nKey="alerting.alertVersionHistory.restore-modal.body">
              Are you sure you want to restore the alert rule definition to this version? All unsaved changes will be
              lost.
            </Trans>
            <Text variant="h6">
              <Trans i18nKey="alerting.alertVersionHistory.restore-modal.summary">
                Summary of changes to be applied:
              </Trans>
            </Text>
            <div>
              {restoreDiff && (
                <>
                  {Object.entries(restoreDiff).map(([key, diffs]) => (
                    <DiffGroup diffs={diffs} key={key} title={key} />
                  ))}
                </>
              )}
            </div>
          </Stack>
        }
        confirmText={'Yes, restore configuration'}
        onConfirm={() => {
          hideConfirmation();
        }}
        onDismiss={() => hideConfirmation()}
      />
      {/* ------------------------------------> END OF RESTORING CODE */}
    </>
  );
}
