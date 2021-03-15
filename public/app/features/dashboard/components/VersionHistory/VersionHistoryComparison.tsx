import React from 'react';
import { css } from 'emotion';

import { Button, ModalsController, CollapsableSection, HorizontalGroup, useStyles } from '@grafana/ui';
import { DecoratedRevisionModel } from '../DashboardSettings/VersionsSettings';
import { RevertDashboardModal } from './RevertDashboardModal';
import { DiffGroup } from './DiffGroup';
import { DiffViewer } from './DiffViewer';
import { jsonDiff } from './utils';
import { GrafanaTheme } from '@grafana/data';

type DiffViewProps = {
  isNewLatest: boolean;
  newInfo: DecoratedRevisionModel;
  baseInfo: DecoratedRevisionModel;
  diffData: { lhs: any; rhs: any };
};

export const VersionHistoryComparison: React.FC<DiffViewProps> = ({ baseInfo, newInfo, diffData, isNewLatest }) => {
  const diff = jsonDiff(diffData.lhs, diffData.rhs);
  const styles = useStyles(getStyles);

  return (
    <div>
      <HorizontalGroup justify="space-between" align="center">
        <div>
          <p className="small muted">
            <strong>Version {newInfo.version}</strong> updated by
            <span>{newInfo.createdBy} </span>
            <span>{newInfo.ageString}</span>
            <span> - {newInfo.message}</span>
          </p>
          <p className="small muted">
            <strong>Version {baseInfo.version}</strong> updated by
            <span>{baseInfo.createdBy} </span>
            <span>{baseInfo.ageString}</span>
            <span> - {baseInfo.message}</span>
          </p>
        </div>
        {isNewLatest && (
          <ModalsController>
            {({ showModal, hideModal }) => (
              <Button
                variant="destructive"
                icon="history"
                onClick={() => {
                  showModal(RevertDashboardModal, {
                    version: baseInfo.version,
                    hideModal,
                  });
                }}
              >
                Restore to version {baseInfo.version}
              </Button>
            )}
          </ModalsController>
        )}
      </HorizontalGroup>

      <div className={styles.spacer}>
        {Object.entries(diff).map(([key, diffs]) => (
          <DiffGroup diffs={diffs} key={key} title={key} />
        ))}
      </div>
      <div className={styles.spacer}>
        <CollapsableSection isOpen={false} label="JSON Diff">
          <DiffViewer
            oldValue={JSON.stringify(diffData.lhs, null, 2)}
            newValue={JSON.stringify(diffData.rhs, null, 2)}
          />
        </CollapsableSection>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  spacer: css`
    padding-top: ${theme.spacing.lg};
  `,
});
