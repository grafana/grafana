import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { useAssistant } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, IconButton, useStyles2, Text, Stack } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { DashboardEmptyExtensionPoint } from './DashboardEmptyExtensionPoint';
import {
  useRepositoryStatus,
  useOnAddVisualization,
  useOnAddLibraryPanel,
  useOnImportDashboard,
} from './DashboardEmptyHooks';

interface InternalProps {
  dashboard: DashboardModel | DashboardScene;
  onAddVisualization?: () => void;
}

const InternalDashboardEmpty = ({ onAddVisualization }: InternalProps) => {
  const styles = useStyles2(getStyles);
  const [prompt, setPrompt] = useState('');
  const { openAssistant } = useAssistant();

  const handleSubmit = useCallback(() => {
    if (prompt.trim() && openAssistant) {
      openAssistant({
        origin: 'dashboard/empty-state',
        mode: 'dashboarding',
        prompt: prompt.trim(),
        autoSend: true,
      });
    }
  }, [prompt, openAssistant]);

  return (
    <Stack alignItems="center" justifyContent="center">
      <div className={styles.wrapper}>
        <Stack direction="column" alignItems="center" gap={3}>
          <div className={styles.sparkleCircle}>
            <Icon name="ai-sparkle" size="xxl" className={styles.sparkleIcon} />
          </div>

          <Text element="h1" textAlignment="center" weight="medium">
            <Trans i18nKey="dashboard.empty.ai-welcome-title">Welcome to your dashboard</Trans>
          </Text>

          <Text element="p" textAlignment="center" color="secondary">
            <Trans i18nKey="dashboard.empty.ai-welcome-subtitle">
              What would you like to visualize today?
            </Trans>
          </Text>

          <div className={styles.promptBar}>
            <IconButton
              name="plus"
              size="lg"
              aria-label={t('dashboard.empty.ai-add-panel-aria', 'Add panel manually')}
              tooltip={t('dashboard.empty.ai-add-panel-tooltip', 'Add panel')}
              onClick={onAddVisualization}
              className={styles.promptButton}
            />
            <input
              className={styles.promptInput}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('dashboard.empty.ai-prompt-placeholder', 'Server performance metrics')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit();
                }
              }}
            />
            <IconButton
              name="arrow-right"
              size="lg"
              aria-label={t('dashboard.empty.ai-submit-aria', 'Submit prompt')}
              tooltip={t('dashboard.empty.ai-submit-tooltip', 'Submit')}
              onClick={handleSubmit}
              className={styles.promptButton}
            />
          </div>

          <Button icon="apps" fill="text" onClick={onAddVisualization}>
            <Trans i18nKey="dashboard.empty.ai-add-panel-button">Add a panel</Trans>
          </Button>
        </Stack>
      </div>
    </Stack>
  );
};

export interface Props {
  dashboard: DashboardModel | DashboardScene;
  canCreate: boolean;
}

const DashboardEmpty = (props: Props) => {
  const { isReadOnlyRepo, isProvisioned } = useRepositoryStatus(props);
  const onAddVisualization = useOnAddVisualization({ ...props, isReadOnlyRepo, isProvisioned });
  const onAddLibraryPanel = useOnAddLibraryPanel({ ...props, isReadOnlyRepo, isProvisioned });
  const onImportDashboard = useOnImportDashboard({ ...props, isReadOnlyRepo, isProvisioned });

  return (
    <DashboardEmptyExtensionPoint
      renderDefaultUI={useCallback(
        () => (
          <InternalDashboardEmpty dashboard={props.dashboard} onAddVisualization={onAddVisualization} />
        ),
        [onAddVisualization, props.dashboard]
      )}
      onAddVisualization={onAddVisualization}
      onAddLibraryPanel={onAddLibraryPanel}
      onImportDashboard={onImportDashboard}
    />
  );
};

export default DashboardEmpty;

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: theme.spacing(12),
      width: '100%',
      maxWidth: '600px',
    }),
    sparkleCircle: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '64px',
      height: '64px',
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.background.secondary,
    }),
    sparkleIcon: css({
      color: theme.colors.primary.text,
    }),
    promptBar: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      width: '100%',
      padding: theme.spacing(0.5, 1),
      borderRadius: theme.shape.radius.pill,
      border: `1px solid ${theme.colors.border.medium}`,
      background: theme.colors.background.primary,
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create('border-color'),
      },
      '&:focus-within': {
        borderColor: theme.colors.primary.border,
      },
    }),
    promptInput: css({
      flex: 1,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: theme.colors.text.primary,
      fontSize: theme.typography.fontSize,
      fontFamily: theme.typography.fontFamily,
      padding: theme.spacing(1, 0),
      '&::placeholder': {
        color: theme.colors.text.disabled,
      },
    }),
    promptButton: css({
      flexShrink: 0,
    }),
  };
}
