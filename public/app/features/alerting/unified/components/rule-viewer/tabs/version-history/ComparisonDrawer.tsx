import { useCallback, useState } from 'react';

import { config } from '@grafana/runtime';
import { Box, Button, Drawer, Stack } from '@grafana/ui';
import { RevisionModel, VersionHistoryComparison } from 'app/core/components/VersionHistory/VersionHistoryComparison';
import { Trans, t } from 'app/core/internationalization';
import { GrafanaRuleIdentifier } from 'app/types/unified-alerting';
import { GrafanaRuleDefinition, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { ConfirmVersionRestoreModal } from './ConfirmVersionRestoreModal';
import { getSpecialUidsDisplayMap, preprocessRuleForDiffDisplay } from './versions-utils';

interface ComparisonDrawerProps {
  oldVersion: RulerGrafanaRuleDTO<GrafanaRuleDefinition>;
  newVersion: RulerGrafanaRuleDTO<GrafanaRuleDefinition>;
  ruleIdentifier: GrafanaRuleIdentifier;
  isNewLatest: boolean;
  setShowDrawer: (show: boolean) => void;
}

/**
 * Turns a version of a Grafana rule definition into data structure
 * used to display the version summary when comparing versions
 */
function parseVersionInfoToSummary(version: RulerGrafanaRuleDTO<GrafanaRuleDefinition>): RevisionModel {
  const unknown = t('alerting.alertVersionHistory.unknown', 'Unknown');
  const SPECIAL_UID_MAP = getSpecialUidsDisplayMap();
  const createdBy = (() => {
    const updatedBy = version?.grafana_alert.updated_by;
    const uid = updatedBy?.uid;
    const name = updatedBy?.name;

    if (!updatedBy) {
      return unknown;
    }
    if (uid && SPECIAL_UID_MAP[uid]) {
      return SPECIAL_UID_MAP[uid].name;
    }
    if (name) {
      return name;
    }
    return uid ? t('alerting.alertVersionHistory.user-id', 'User ID {{uid}}', { uid }) : unknown;
  })();

  return {
    created: version.grafana_alert.updated || unknown,
    createdBy,
    version: version.grafana_alert.version || unknown,
  };
}

export const ComparisonDrawer = ({
  oldVersion,
  newVersion,
  ruleIdentifier,
  isNewLatest,
  setShowDrawer,
}: ComparisonDrawerProps) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const onDismiss = useCallback(() => setShowDrawer(false), [setShowDrawer]);

  const oldVersionSummary = parseVersionInfoToSummary(oldVersion);
  const newVersionSummary = parseVersionInfoToSummary(newVersion);
  return (
    <>
      <Drawer
        onClose={() => setShowDrawer(false)}
        title={t('alerting.alertVersionHistory.comparing-versions', 'Comparing versions')}
      >
        <VersionHistoryComparison
          oldSummary={oldVersionSummary}
          oldVersion={oldVersion}
          newSummary={newVersionSummary}
          newVersion={newVersion}
          preprocessVersion={preprocessRuleForDiffDisplay}
        />
        {config.featureToggles.alertingRuleVersionHistoryRestore && isNewLatest && (
          <Box paddingTop={2}>
            <Stack justifyContent="flex-end">
              <Button
                variant="destructive"
                onClick={() => {
                  setShowConfirmModal(true);
                }}
                icon="history"
              >
                <Trans i18nKey="alerting.alertVersionHistory.restore-version">
                  Restore to version {{ version: oldVersion.grafana_alert.version }}
                </Trans>
              </Button>
            </Stack>
          </Box>
        )}
      </Drawer>
      {showConfirmModal && (
        <ConfirmVersionRestoreModal
          ruleIdentifier={ruleIdentifier}
          baseVersion={newVersion}
          versionToRestore={oldVersion}
          isOpen={showConfirmModal}
          onDismiss={onDismiss}
        />
      )}
    </>
  );
};
