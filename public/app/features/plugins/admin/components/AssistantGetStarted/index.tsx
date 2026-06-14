/**
 * Custom Overview page for the Grafana Assistant plugin.
 *
 * Renders a guided 3-step onboarding flow (install → connect → start) instead of the standard
 * plugin readme. Step 2 prefers the plugin's own connection flow when it exposes a component at
 * {@link ASSISTANT_CONNECT_COMPONENT_ID}, falling back to a Grafana Cloud sign-up link otherwise.
 */
import { css } from '@emotion/css';
import { useEffect, useRef, useState, type JSX } from 'react';

import { useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2, type GrafanaPlugin } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { Button, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { useInstall, useInstallStatus } from '../../state/hooks';
import { type CatalogPlugin } from '../../types';

import { ContentSections } from './ContentSections';
import { StepCard, getStepState } from './StepCard';
import { TryAskingSection } from './TryAskingSection';
import {
  ASSISTANT_CONNECT_COMPONENT_ID,
  CLOUD_SIGNUP_URL,
  type AssistantConnectComponentProps,
  type AssistantOpenOverrides,
  type SetupState,
} from './constants';

const RELOAD_DELAY_MS = 1500;

interface AssistantGetStartedProps {
  plugin: CatalogPlugin;
  pluginConfig?: GrafanaPlugin | null;
  pluginConfigLoading?: boolean;
}

function getSetupState(plugin: CatalogPlugin, pluginConfig?: GrafanaPlugin | null, loading?: boolean): SetupState {
  if (!plugin.isInstalled) {
    return 'not-installed';
  }
  if (loading) {
    return 'loading';
  }
  if (!pluginConfig || !pluginConfig.meta.enabled) {
    return 'not-connected';
  }
  return 'connected';
}

export function AssistantGetStarted({
  plugin,
  pluginConfig,
  pluginConfigLoading,
}: AssistantGetStartedProps): JSX.Element {
  const styles = useStyles2(getStyles);
  const installPlugin = useInstall();
  const { isInstalling } = useInstallStatus();
  const { openAssistant } = useAssistant();
  const { component: AssistantConnect, isLoading: connectComponentLoading } =
    usePluginComponent<AssistantConnectComponentProps>(ASSISTANT_CONNECT_COMPONENT_ID);
  const [installedReloading, setInstalledReloading] = useState(false);
  const canInstall = contextSrv.hasPermission(AccessControlAction.PluginsInstall);
  const reloadTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (reloadTimeout.current) {
        clearTimeout(reloadTimeout.current);
      }
    };
  }, []);

  const assistantAvailable = Boolean(openAssistant);
  const state = installedReloading ? 'reloading' : getSetupState(plugin, pluginConfig, pluginConfigLoading);

  const handleInstall = async () => {
    const result = await installPlugin(plugin.id);
    // Install errors are surfaced by Redux toast notifications.
    if (!('error' in result)) {
      setInstalledReloading(true);
      reloadTimeout.current = setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
    }
  };

  const handleOpenAssistant = (props?: AssistantOpenOverrides) => {
    openAssistant?.({
      origin: 'grafana/plugins/admin/assistant-get-started',
      ...props,
    });
  };

  // Prefer the plugin's inline connection flow when it exposes one; otherwise fall back to the
  // Cloud sign-up link. While the plugin module is still loading we render nothing to avoid
  // flashing the fallback link and then swapping it out.
  const renderConnectAction = (): JSX.Element | undefined => {
    if (AssistantConnect) {
      return <AssistantConnect onConnected={() => window.location.reload()} />;
    }
    if (connectComponentLoading) {
      return undefined;
    }
    return (
      <LinkButton size="sm" href={CLOUD_SIGNUP_URL} target="_blank" rel="noopener noreferrer">
        <Trans i18nKey="plugins.assistant-get-started.step2.connect">Connect</Trans>
      </LinkButton>
    );
  };

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={2}>
        <Text element="h2" variant="h4" weight="medium">
          <Trans i18nKey="plugins.assistant-get-started.steps-heading">Set up in 3 steps</Trans>
        </Text>
        <div className={styles.stepsGrid} aria-label={t('plugins.assistant-get-started.steps-label', 'Setup steps')}>
          <StepCard
            number={1}
            title={
              state === 'reloading'
                ? t('plugins.assistant-get-started.step1.title-reloading', 'Installed! Loading plugin...')
                : t('plugins.assistant-get-started.step1.title', 'Install the plugin')
            }
            description={
              state === 'reloading'
                ? t('plugins.assistant-get-started.step1.description-reloading', 'The page will refresh automatically.')
                : !canInstall && state === 'not-installed'
                  ? t(
                      'plugins.assistant-get-started.step1.description-no-permission',
                      'An administrator needs to install this plugin.'
                    )
                  : t(
                      'plugins.assistant-get-started.step1.description',
                      "You're already here! Click Install to add the Grafana Assistant plugin to your instance."
                    )
            }
            state={getStepState(state, 1)}
            action={
              state === 'not-installed' && canInstall ? (
                <Button size="sm" onClick={handleInstall} disabled={isInstalling}>
                  {isInstalling
                    ? t('plugins.assistant-get-started.step1.installing', 'Installing...')
                    : t('plugins.assistant-get-started.step1.install', 'Install')}
                </Button>
              ) : undefined
            }
          />
          <StepCard
            number={2}
            title={t('plugins.assistant-get-started.step2.title', 'Connect to Grafana Cloud')}
            description={t(
              'plugins.assistant-get-started.step2.description',
              'Sign in or create a free Grafana Cloud account to enable AI-powered assistance.'
            )}
            state={getStepState(state, 2)}
            action={getStepState(state, 2) === 'active' ? renderConnectAction() : undefined}
          />
          <StepCard
            number={3}
            title={t('plugins.assistant-get-started.step3.title', 'Start a conversation')}
            description={t(
              'plugins.assistant-get-started.step3.description',
              'Click the Assistant icon in the sidebar. Ask about your data sources, build queries, or create dashboards.'
            )}
            state={getStepState(state, 3)}
            action={
              getStepState(state, 3) === 'active' ? (
                <Button size="sm" onClick={() => handleOpenAssistant()} disabled={!assistantAvailable}>
                  <Trans i18nKey="plugins.assistant-get-started.step3.open">Open Assistant</Trans>
                </Button>
              ) : undefined
            }
          />
        </div>
      </Stack>

      {state === 'connected' && (
        <TryAskingSection onOpenAssistant={handleOpenAssistant} disabled={!assistantAvailable} />
      )}

      <ContentSections />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
    width: '100%',
    maxWidth: `${theme.breakpoints.values.xl}px`,
  }),
  stepsGrid: css({
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    },
  }),
});
