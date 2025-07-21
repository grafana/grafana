import { useCallback, useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Button, EmptyState, LoadingPlaceholder, Stack, Text, Tooltip } from '@grafana/ui';
import { RuleGroupIdentifierV2, RuleIdentifier } from 'app/types/unified-alerting';
import { GrafanaRuleDefinition, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import {
  LogMessages,
  logInfo,
  trackRuleVersionsComparisonClick,
  trackRuleVersionsRestoreFail,
  trackRuleVersionsRestoreSuccess,
} from '../../../Analytics';
import { alertRuleApi } from '../../../api/alertRuleApi';
import { AlertRuleAction, useRulerRuleAbility } from '../../../hooks/useAbilities';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { stringifyErrorLike } from '../../../utils/misc';

import { ComparisonDrawer } from './version-history/ComparisonDrawer';
import { Origin } from './version-history/ConfirmVersionRestoreModal';
import { VersionHistoryTable } from './version-history/VersionHistoryTable';

const { useGetAlertVersionHistoryQuery } = alertRuleApi;

interface AlertVersionHistoryProps {
  rule: RulerGrafanaRuleDTO;
}

/** List of (top level) properties to exclude from being shown in human readable summary of version changes */
export const grafanaAlertPropertiesToIgnore: Array<keyof GrafanaRuleDefinition> = [
  'id',
  'uid',
  'updated',
  'updated_by',
  'version',
];

/**
 * Render the version history of a given Grafana managed alert rule, showing different edits
 * and allowing to restore to a previous version.
 */
export function AlertVersionHistory({ rule }: AlertVersionHistoryProps) {
  const ruleUid = rule.grafana_alert.uid;
  const { isLoading, currentData: ruleVersions = [], error } = useGetAlertVersionHistoryQuery({ uid: ruleUid });

  const ruleIdentifier: RuleIdentifier = useMemo(
    () => ({ ruleSourceName: GRAFANA_RULES_SOURCE_NAME, uid: ruleUid }),
    [ruleUid]
  );

  const [oldVersion, setOldVersion] = useState<RulerGrafanaRuleDTO<GrafanaRuleDefinition>>();
  const [newVersion, setNewVersion] = useState<RulerGrafanaRuleDTO<GrafanaRuleDefinition>>();
  const [showDrawer, setShowDrawer] = useState(false);
  // checked versions for comparison. key is the version number, value is whether it's checked
  const [checkedVersions, setCheckedVersions] = useState(new Set<string>());
  const canCompare = useMemo(() => checkedVersions.size > 1, [checkedVersions]);

  // check if restoring is allowed/enabled
  const groupIdentifier: RuleGroupIdentifierV2 = {
    namespace: { uid: rule.grafana_alert.namespace_uid },
    groupName: rule.grafana_alert.rule_group,
    groupOrigin: 'grafana',
  };
  const [restoreSupported, restoreAllowed] = useRulerRuleAbility(rule, groupIdentifier, AlertRuleAction.Restore);
  const canRestore =
    restoreAllowed && restoreSupported && Boolean(config.featureToggles.alertingRuleVersionHistoryRestore);

  //tracking functions for restore action
  const onRestoreSuccess = useCallback(
    (origin: Origin) => {
      trackRuleVersionsRestoreSuccess({
        origin,
        latest: newVersion === ruleVersions[0],
        oldVersion: oldVersion?.grafana_alert.version || 0,
        newVersion: newVersion?.grafana_alert.version || 0,
      });
    },
    [oldVersion, newVersion, ruleVersions]
  );

  const onRestoreFail = useCallback(
    (origin: Origin, error: Error) => {
      trackRuleVersionsRestoreFail({
        origin,
        latest: newVersion === ruleVersions[0],
        oldVersion: oldVersion?.grafana_alert.version || 0,
        newVersion: newVersion?.grafana_alert.version || 0,
        error,
      });
    },
    [oldVersion, newVersion, ruleVersions]
  );

  if (error) {
    return (
      <Alert title={t('alerting.alertVersionHistory.errorloading', 'Failed to load alert rule versions')}>
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.common.loading', 'Loading...')} />;
  }

  if (!ruleVersions.length) {
    // We don't expect this to happen - all alert rules _should_ have at least one version
    logInfo(LogMessages.noAlertRuleVersionsFound, { ruleUid });
    return (
      <EmptyState
        variant="not-found"
        message={t('alerting.alertVersionHistory.noVersionsFound', 'No versions found for this rule')}
      />
    );
  }

  const compareSelectedVersions = () => {
    // precondition: we have only two versions selected in checkedVersions
    const [older, newer] = ruleVersions
      .filter((rule) => {
        const version = rule.grafana_alert.version;
        if (!version && version !== 0) {
          return;
        }
        return checkedVersions.has(String(rule.grafana_alert.version));
      })
      .sort((a, b) => {
        const aVersion = a.grafana_alert.version;
        const bVersion = b.grafana_alert.version;
        if (aVersion === undefined || bVersion === undefined) {
          return 0;
        }
        return aVersion - bVersion;
      });

    trackRuleVersionsComparisonClick({
      latest: newer === ruleVersions[0],
      oldVersion: older?.grafana_alert.version || 0,
      newVersion: newer?.grafana_alert.version || 0,
    });

    // setting the versions to compare
    compareVersions(older, newer);
  };

  const compareVersions = (
    oldRule: RulerGrafanaRuleDTO<GrafanaRuleDefinition>,
    newRule: RulerGrafanaRuleDTO<GrafanaRuleDefinition>
  ) => {
    setOldVersion(oldRule);
    setNewVersion(newRule);
    setShowDrawer(true);
  };

  function handleCheckedVersionChange(id: string) {
    setCheckedVersions((prevState) => {
      const newState = new Set(prevState);
      newState.has(id) ? newState.delete(id) : newState.add(id);
      return newState;
    });
    setOldVersion(undefined);
    setNewVersion(undefined);
  }

  const isNewLatest = ruleVersions[0].grafana_alert.version === newVersion?.grafana_alert.version;

  return (
    <Stack direction="column" gap={2}>
      <Text variant="body">
        <Trans i18nKey="alerting.alertVersionHistory.description">
          Each time you edit the alert rule, a new version is created. Select two versions below and compare their
          differences.
        </Trans>
      </Text>
      <Stack>
        <Tooltip
          content={t('core.versionHistory.comparison.select', 'Select two versions to start comparing')}
          placement="bottom"
        >
          <Button type="button" disabled={!canCompare} onClick={compareSelectedVersions} icon="code-branch">
            <Trans i18nKey="alerting.alertVersionHistory.compareVersions">Compare versions</Trans>
          </Button>
        </Tooltip>
      </Stack>
      {showDrawer && oldVersion && newVersion && (
        <ComparisonDrawer
          oldVersion={oldVersion}
          newVersion={newVersion}
          ruleIdentifier={ruleIdentifier}
          isNewLatest={isNewLatest}
          setShowDrawer={setShowDrawer}
          onRestoreSuccess={() => onRestoreSuccess('comparison-drawer')}
          onRestoreError={(err: Error) => onRestoreFail('comparison-drawer', err)}
          canRestore={canRestore}
        />
      )}
      <VersionHistoryTable
        onCompareSingleVersion={(rule) => compareVersions(rule, ruleVersions[0])}
        onVersionsChecked={handleCheckedVersionChange}
        ruleVersions={ruleVersions}
        disableSelection={canCompare}
        checkedVersions={checkedVersions}
        onRestoreSuccess={() => onRestoreSuccess('version-list')}
        onRestoreError={(err: Error) => onRestoreFail('version-list', err)}
        canRestore={canRestore}
      />
    </Stack>
  );
}
