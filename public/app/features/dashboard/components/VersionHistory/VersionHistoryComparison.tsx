import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
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
            <Trans
              i18nKey="dashboard.version-history-comparison.old-updated-by"
              values={{ version: baseInfo.version, editor: baseInfo.createdBy, timeAgo: baseInfo.ageString }}
            >
              <strong>Version {'{{version}}'}</strong> updated by {'{{editor}}'} {'{{timeAgo}}'}
            </Trans>
            {baseInfo.message}
          </span>
          <Icon name="arrow-right" size="sm" />
          <span className={styles.versionInfo}>
            <Trans
              i18nKey="dashboard.version-history-comparison.new-updated-by"
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
                    id: baseInfo.id,
                    version: baseInfo.version,
                    hideModal,
                  });
                }}
              >
                <Trans
                  i18nKey="dashboard.version-history-comparison.button-restore"
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
          label={t('dashboard.version-history-comparison.label-view-json-diff', 'View JSON diff')}
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
