import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ModalsController, CollapsableSection, HorizontalGroup, useStyles2 } from '@grafana/ui';

import { DecoratedRevisionModel } from '../DashboardSettings/VersionsSettings';

import { DiffGroup } from './DiffGroup';
import { DiffViewer } from './DiffViewer';
import { RevertDashboardModal } from './RevertDashboardModal';
import { jsonDiff } from './utils';

type DiffViewProps = {
  isNewLatest: boolean;
  newInfo: DecoratedRevisionModel;
  baseInfo: DecoratedRevisionModel;
  diffData: { lhs: unknown; rhs: unknown };
};

export const VersionHistoryComparison: React.FC<DiffViewProps> = ({ baseInfo, newInfo, diffData, isNewLatest }) => {
  const diff = jsonDiff(diffData.lhs, diffData.rhs);
  const styles = useStyles2(getStyles);

  return (
    <div>
      <div className={styles.spacer}>
        <HorizontalGroup justify="space-between" align="center">
          <div>
            <p className={styles.versionInfo}>
              <strong>Version {newInfo.version}</strong> updated by {newInfo.createdBy} {newInfo.ageString} -{' '}
              {newInfo.message}
            </p>
            <p className={cx(styles.versionInfo, styles.noMarginBottom)}>
              <strong>Version {baseInfo.version}</strong> updated by {baseInfo.createdBy} {baseInfo.ageString} -{' '}
              {baseInfo.message}
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
      </div>
      <div className={styles.spacer}>
        {Object.entries(diff).map(([key, diffs]) => (
          <DiffGroup diffs={diffs} key={key} title={key} />
        ))}
      </div>
      <CollapsableSection isOpen={false} label="View JSON Diff">
        <DiffViewer oldValue={JSON.stringify(diffData.lhs, null, 2)} newValue={JSON.stringify(diffData.rhs, null, 2)} />
      </CollapsableSection>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  spacer: css`
    margin-bottom: ${theme.spacing(4)};
  `,
  versionInfo: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  noMarginBottom: css`
    margin-bottom: 0;
  `,
});
