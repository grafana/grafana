import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, ModalsController, CollapsableSection, useStyles2, Stack, Icon, Box } from '@grafana/ui';

import { DecoratedRevisionModel } from '../VersionsEditView';

import { DiffGroup } from './DiffGroup';
import { DiffViewer } from './DiffViewer';
import { RevertDashboardModal } from './RevertDashboardModal';
import { jsonDiff } from './utils';

type DiffViewProps = {
  isNewLatest: boolean;
  newInfo: DecoratedRevisionModel;
  baseInfo: DecoratedRevisionModel;
  diffData: { lhs: string; rhs: string };
  onRestore: (version: DecoratedRevisionModel) => Promise<boolean>;
};

export const VersionHistoryComparison = ({ baseInfo, newInfo, diffData, isNewLatest, onRestore }: DiffViewProps) => {
  const diff = jsonDiff(diffData.lhs, diffData.rhs);
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={1}>
      <Stack justifyContent="space-between" alignItems="center">
        <Stack alignItems="center">
          <span className={cx(styles.versionInfo, styles.noMarginBottom)}>
            <Trans
              i18nKey="dashboard-scene.version-history-comparison.old-version-updated"
              values={{ version: baseInfo.version, editor: baseInfo.createdBy, timeAgo: baseInfo.ageString }}
            >
              <strong>Version {'{{version}}'}</strong> updated by {'{{editor}}'} {'{{timeAgo}}'}
            </Trans>
            {baseInfo.message}
          </span>
          <Icon name="arrow-right" size="sm" />
          <span className={styles.versionInfo}>
            <Trans
              i18nKey="dashboard-scene.version-history-comparison.new-version-updated"
              values={{ version: newInfo.version, editor: newInfo.createdBy, timeAgo: newInfo.ageString }}
            >
              <strong>Version {'{{version}}'}</strong> updated by {'{{editor}}'} {'{{timeAgo}}'}
            </Trans>
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
                    version: baseInfo,
                    onRestore,
                    hideModal,
                  });
                }}
              >
                <Trans
                  i18nKey="dashboard-scene.version-history.comparison.button-restore"
                  values={{ version: baseInfo.version }}
                >
                  Restore to version {'{{version}}'}
                </Trans>
              </Button>
            )}
          </ModalsController>
        )}
      </Stack>

      {Object.entries(diff).map(([key, diffs]) => (
        <DiffGroup diffs={diffs} key={key} title={key} />
      ))}

      <Box paddingTop={2}>
        <CollapsableSection
          isOpen={false}
          label={t('dashboard-scene.version-history-comparison.label-view-json-diff', 'View JSON diff')}
        >
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
