import { useMemo, useState } from 'react';

import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Badge, Button, Checkbox, Column, ConfirmModal, InteractiveTable, Stack, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { useUpdateRuleInRuleGroup } from 'app/features/alerting/unified/hooks/ruleGroup/useUpsertRuleFromRuleGroup';
import { useRuleWithLocation } from 'app/features/alerting/unified/hooks/useCombinedRule';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { computeVersionDiff } from 'app/features/alerting/unified/utils/diff';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { fromRulerRuleAndRuleGroupIdentifier } from 'app/features/alerting/unified/utils/rule-id';
import { getRuleGroupLocationFromRuleWithLocation } from 'app/features/alerting/unified/utils/rules';
import { DiffGroup } from 'app/features/dashboard-scene/settings/version-history/DiffGroup';
import { Diffs, jsonDiff } from 'app/features/dashboard-scene/settings/version-history/utils';
import { RuleIdentifier } from 'app/types/unified-alerting';
import { GrafanaRuleDefinition, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { UpdatedByUser } from './UpdatedBy';

const VERSIONS_PAGE_SIZE = 20;

function useRestoreVersion(ruleIdentifier: RuleIdentifier, newVersion?: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) {
  const { loading: loadingAlertRule, result: ruleWithLocation, error } = useRuleWithLocation({ ruleIdentifier });

  const [updateRuleInRuleGroup] = useUpdateRuleInRuleGroup();

  const onRestoreVersion = async (newVersion: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) => {
    if (!newVersion) {
      return;
    }
    if (
      !loadingAlertRule &&
      ruleWithLocation &&
      !error &&
      newVersion.grafana_alert.rule_group === newVersion.grafana_alert.rule_group
    ) {
      const ruleGroupIdentifier = getRuleGroupLocationFromRuleWithLocation(ruleWithLocation);
      const ruleIdentifier = fromRulerRuleAndRuleGroupIdentifier(ruleGroupIdentifier, newVersion);
      // restore version
      await updateRuleInRuleGroup.execute(ruleGroupIdentifier, ruleIdentifier, newVersion, {
        dataSourceName: GRAFANA_RULES_SOURCE_NAME,
        namespaceName: newVersion.grafana_alert.namespace_uid,
        groupName: newVersion.grafana_alert.rule_group,
      });
    }
  };
  return onRestoreVersion;
}

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
  const [ruleToRestore, setRuleToRestore] = useState<RulerGrafanaRuleDTO<GrafanaRuleDefinition>>();
  const ruleIdentifier: RuleIdentifier = useMemo(
    () => ({ ruleSourceName: GRAFANA_RULES_SOURCE_NAME, uid: ruleToRestore?.grafana_alert?.uid ?? '' }),
    [ruleToRestore]
  );
  const restoreFn = useRestoreVersion(ruleIdentifier, ruleToRestore);
  const [restoreError, setRestoreError] = useState<Error | undefined>();

  const showConfirmation = (ruleToRestore: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) => {
    const currentVersion = ruleVersions[0];
    setConfirmRestore(true);
    setRuleToRestore(ruleToRestore);
    setRestoreDiff(jsonDiff(currentVersion, ruleToRestore));
  };

  const hideConfirmation = () => {
    setConfirmRestore(false);
  };

  function onRestoreConfirm() {
    if (restoreError) {
      setRestoreError(undefined);
      hideConfirmation();
      return;
    }
    if (ruleToRestore) {
      restoreFn(ruleToRestore)
        .then(() => {
          setRestoreError(undefined);
          hideConfirmation();
        })
        .catch((err) => {
          setRestoreError(err);
        });
    }
  }

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
                  row.original.grafana_alert.version && showConfirmation(row.original);
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
      <ConfirmModal
        isOpen={confirmRestore}
        title={t('alerting.alertVersionHistory.restore-modal.title', 'Restore Version')}
        disabled={Boolean(restoreError)}
        body={
          <Stack direction="column" gap={2}>
            {!restoreError && (
              <Trans i18nKey="alerting.alertVersionHistory.restore-modal.body">
                Are you sure you want to restore the alert rule definition to this version? All unsaved changes will be
                lost.
              </Trans>
            )}
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
            {restoreError && (
              <Alert severity="error" title={t('alerting.alertVersionHistory.restore-modal.error', 'Error')}>
                {stringifyErrorLike(restoreError)}
              </Alert>
            )}
          </Stack>
        }
        confirmText={'Yes, restore configuration'}
        onConfirm={onRestoreConfirm}
        onDismiss={() => {
          hideConfirmation();
          setRestoreError(undefined);
        }}
      />
    </>
  );
}
