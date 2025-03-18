import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ModalsController, CollapsableSection, useStyles2, Stack, Icon, Box } from '@grafana/ui';
import { DiffGroup } from 'app/features/dashboard-scene/settings/version-history/DiffGroup';
import { DiffViewer } from 'app/features/dashboard-scene/settings/version-history/DiffViewer';
import { jsonDiff } from 'app/features/dashboard-scene/settings/version-history/utils';

import { DecoratedRevisionModel } from '../DashboardSettings/VersionsSettings';

import { RevertDashboardModal } from './RevertDashboardModal';

type DiffViewProps = {
  isNewLatest: boolean;
  newInfo: DecoratedRevisionModel;
  baseInfo: DecoratedRevisionModel;
  diffData: { lhs: string; rhs: string };
};

export const VersionHistoryComparison = ({ baseInfo, newInfo, diffData, isNewLatest }: DiffViewProps) => {
  const diff = jsonDiff(diffData.lhs, diffData.rhs);
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={1}>
      <Stack justifyContent="space-between" alignItems="center">
        <Stack alignItems="center">
          <span className={cx(styles.versionInfo, styles.noMarginBottom)}>
            <strong>Version {baseInfo.version}</strong> updated by {baseInfo.createdBy} {baseInfo.ageString}
            {baseInfo.message}
          </span>
          <Icon name="arrow-right" size="sm" />
          <span className={styles.versionInfo}>
            <strong>Version {newInfo.version}</strong> updated by {newInfo.createdBy} {newInfo.ageString}
            {newInfo.message}
          </span>
        </Stack>
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
      </Stack>

      {Object.entries(diff).map(([key, diffs]) => (
        <DiffGroup diffs={diffs} key={key} title={key} />
      ))}

      <Box paddingTop={2}>
        <CollapsableSection isOpen={false} label="View JSON Diff">
          <DiffViewer
            oldValue={JSON.stringify(diffData.lhs, null, 2)}
            newValue={JSON.stringify(diffData.rhs, null, 2)}
          />
        </CollapsableSection>
      </Box>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  versionInfo: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  noMarginBottom: css({
    marginBottom: 0,
  }),
});
