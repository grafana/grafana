import { useCallback, useState } from 'react';

import { Drawer } from '@grafana/ui';
import { VersionHistoryComparison } from 'app/core/components/VersionHistory/VersionHistoryComparison';
import { t } from 'app/core/internationalization';
import { GrafanaRuleIdentifier } from 'app/types/unified-alerting';
import { GrafanaRuleDefinition, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { ConfirmVersionRestoreModal } from './ConfirmVersionRestoreModal';
import { parseVersionInfoToSummary, preprocessRuleForDiffDisplay } from './versions-utils';

interface ComparisonDrawerProps {
  oldVersion: RulerGrafanaRuleDTO<GrafanaRuleDefinition>;
  newVersion: RulerGrafanaRuleDTO<GrafanaRuleDefinition>;
  ruleIdentifier: GrafanaRuleIdentifier;
  isNewLatest: boolean;
  setShowDrawer: (show: boolean) => void;
  onRestoreSuccess: () => void;
  onRestoreError: (error: Error) => void;
  canRestore: boolean;
}

export const ComparisonDrawer = ({
  oldVersion,
  newVersion,
  ruleIdentifier,
  isNewLatest,
  setShowDrawer,
  onRestoreSuccess,
  onRestoreError,
  canRestore,
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
          showRestoreButton={isNewLatest && canRestore}
          onRestore={() => setShowConfirmModal(true)}
        />
      </Drawer>
      {showConfirmModal && (
        <ConfirmVersionRestoreModal
          ruleIdentifier={ruleIdentifier}
          baseVersion={newVersion}
          versionToRestore={oldVersion}
          isOpen={showConfirmModal}
          onDismiss={onDismiss}
          onRestoreSucess={onRestoreSuccess}
          onRestoreError={onRestoreError}
        />
      )}
    </>
  );
};
