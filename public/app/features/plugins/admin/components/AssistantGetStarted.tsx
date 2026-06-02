/**
 * Custom Overview page for the Grafana Assistant plugin.
 *
 * Renders a guided 3-step onboarding flow (install → connect → start) instead of the standard
 * plugin readme. Step 2 prefers the plugin's own connection flow when it exposes a component at
 * {@link ASSISTANT_CONNECT_COMPONENT_ID}, falling back to a Grafana Cloud sign-up link otherwise.
 */
import { css } from '@emotion/css';
import { useEffect, useRef, useState, type JSX } from 'react';

import { useAssistant, type OpenAssistantProps } from '@grafana/assistant';
import { type GrafanaTheme2, type GrafanaPlugin } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { Badge, Box, Button, Icon, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { useInstall, useInstallStatus } from '../state/hooks';
import { type CatalogPlugin } from '../types';

/** Plugin ID constant — also used in PluginDetailsBody.tsx and usePluginDetailsTabs.tsx */
export const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';

/**
 * ID of the connect component the Assistant plugin exposes via `AppPlugin.exposeComponent()`.
 * When present it replaces the static Cloud sign-up link in step 2 with the plugin's real
 * connection flow. The string must stay in sync with the plugin's `exposeComponent({ id })` call.
 */
export const ASSISTANT_CONNECT_COMPONENT_ID = 'grafana-assistant-app/connect/v1';

/** Props passed to the exposed connect component. Kept in sync with the plugin side. */
export interface AssistantConnectComponentProps {
  /** Invoked by the plugin once the instance is successfully connected to Grafana Cloud. */
  onConnected?: () => void;
}

const CLOUD_SIGNUP_URL =
  'https://grafana.com/auth/sign-up/?utm_source=grafana_oss&utm_medium=onprem_assistant&utm_campaign=assistant_onboarding&cta=connect_step2';

const RELOAD_DELAY_MS = 1500;

type SetupState = 'not-installed' | 'reloading' | 'loading' | 'not-connected' | 'connected';
type AssistantOpenOverrides = Omit<Partial<OpenAssistantProps>, 'origin'>;

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

      <IncludedFreePanel />
      <DataAccessSection />
      <CapabilitiesSection />
      <RequirementsSection />
    </div>
  );
}

// --- Step state logic ---

type StepState = 'complete' | 'active' | 'disabled';

function getStepState(setupState: SetupState, step: number): StepState {
  switch (setupState) {
    case 'not-installed':
      return step === 1 ? 'active' : 'disabled';
    case 'reloading':
    case 'loading':
      return step === 1 ? 'complete' : 'disabled';
    case 'not-connected':
      if (step === 1) {
        return 'complete';
      }
      return step === 2 ? 'active' : 'disabled';
    case 'connected':
      if (step <= 2) {
        return 'complete';
      }
      return 'active';
  }
}

// --- Sub-components ---

function StepCard({
  number,
  title,
  description,
  state,
  action,
}: {
  number: number;
  title: string;
  description: string;
  state: StepState;
  action?: JSX.Element;
}) {
  const styles = useStyles2(getStepStyles);

  const stepNumberClass =
    state === 'complete'
      ? styles.stepNumberComplete
      : state === 'disabled'
        ? styles.stepNumberDisabled
        : styles.stepNumber;

  const cardClass = state === 'disabled' ? styles.cardDisabled : styles.card;

  const stepLabel =
    state === 'complete'
      ? t('plugins.assistant-get-started.step-card.label-complete', 'Step {{number}}: complete', { number })
      : t('plugins.assistant-get-started.step-card.label', 'Step {{number}}', { number });

  return (
    <div className={cardClass} role="group" aria-label={stepLabel}>
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={1.5} alignItems="center">
          <div className={stepNumberClass} aria-hidden="true">
            {state === 'complete' ? <Icon name="check" size="sm" /> : <span>{number}</span>}
          </div>
          <Text weight="medium">{title}</Text>
        </Stack>
        <Text color="secondary">{description}</Text>
        {action && <div>{action}</div>}
      </Stack>
    </div>
  );
}

function IncludedFreePanel() {
  return (
    <Stack direction="column" gap={2}>
      <Text element="h2" variant="h4" weight="medium">
        <Trans i18nKey="plugins.assistant-get-started.included-free.heading">
          Included free, no credit card required
        </Trans>
      </Text>
      <Box backgroundColor="secondary" borderColor="weak" borderStyle="solid" padding={3}>
        <Stack direction="column" gap={2}>
          <div>
            <Badge
              text={t('plugins.assistant-get-started.included-free.badge', 'Included free')}
              color="green"
              icon="ai-sparkle"
            />
          </div>
          <Text color="secondary">
            <Trans i18nKey="plugins.assistant-get-started.included-free.description">
              Grafana Assistant is included in the Grafana Cloud forever free plan with generous limits so you can get
              started right away.
            </Trans>
          </Text>
          <Stack direction="column" gap={1}>
            <FeatureItem
              text={t(
                'plugins.assistant-get-started.included-free.item-team',
                'Free access for your team on Grafana Cloud'
              )}
            />
            <FeatureItem
              text={t('plugins.assistant-get-started.included-free.item-usage', 'Generous usage for getting started')}
            />
            <FeatureItem
              text={t(
                'plugins.assistant-get-started.included-free.item-nl',
                'Natural language to PromQL, LogQL, TraceQL, and SQL'
              )}
            />
            <FeatureItem
              text={t('plugins.assistant-get-started.included-free.item-dashboards', 'Dashboard creation and editing')}
            />
            <FeatureItem
              text={t(
                'plugins.assistant-get-started.included-free.item-alerts',
                'Alert investigation and troubleshooting'
              )}
            />
            <FeatureItem
              text={t(
                'plugins.assistant-get-started.included-free.item-navigation',
                'Navigation and discovery assistance'
              )}
            />
          </Stack>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="plugins.assistant-get-started.included-free.pricing">
              Need more capacity or advanced plan features?{' '}
              <TextLink href="https://grafana.com/pricing/" external>
                View pricing plans →
              </TextLink>
            </Trans>
          </Text>
        </Stack>
      </Box>
    </Stack>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Icon name="check" size="sm" />
      <Text color="secondary">{text}</Text>
    </Stack>
  );
}

function DataAccessSection() {
  const styles = useStyles2(getStyles);

  const faqs = [
    {
      question: t('plugins.assistant-get-started.data-access.faq-third-parties-q', 'Is my data sent to third parties?'),
      answer: t(
        'plugins.assistant-get-started.data-access.faq-third-parties-a',
        'No. Queries are processed by Grafana Labs infrastructure. All communication is encrypted in transit.'
      ),
    },
    {
      question: t('plugins.assistant-get-started.data-access.faq-rbac-q', 'Does this work with RBAC?'),
      answer: t(
        'plugins.assistant-get-started.data-access.faq-rbac-a',
        'Yes. The Assistant respects your existing role-based access control. Users only see resources they have access to.'
      ),
    },
    {
      question: t('plugins.assistant-get-started.data-access.faq-non-admin-q', 'Can non-admin users use it?'),
      answer: t(
        'plugins.assistant-get-started.data-access.faq-non-admin-a',
        'Yes, once an admin has installed the plugin and connected to Cloud, any user in the org can use the Assistant based on their existing permissions.'
      ),
    },
    {
      question: t(
        'plugins.assistant-get-started.data-access.faq-self-managed-q',
        'Is this available for self-managed Grafana?'
      ),
      answer: t(
        'plugins.assistant-get-started.data-access.faq-self-managed-a',
        "Yes — that's exactly what this setup flow is for."
      ),
    },
  ];

  return (
    <Stack direction="column" gap={2}>
      <Text element="h2" variant="h4" weight="medium">
        <Trans i18nKey="plugins.assistant-get-started.data-access.heading">What data does the Assistant access?</Trans>
      </Text>
      <Text color="secondary">
        <Trans i18nKey="plugins.assistant-get-started.data-access.intro">
          The Assistant reads <strong>metadata and schema only</strong> — dashboard names, panel titles, data source
          types, and metric/label names. It never reads your actual metric data or query results.
        </Trans>
      </Text>
      <table className={styles.faqTable}>
        <thead>
          <tr className={styles.faqHeader}>
            <th>
              <Text weight="medium">
                <Trans i18nKey="plugins.assistant-get-started.data-access.col-question">Question</Trans>
              </Text>
            </th>
            <th>
              <Text weight="medium">
                <Trans i18nKey="plugins.assistant-get-started.data-access.col-answer">Answer</Trans>
              </Text>
            </th>
          </tr>
        </thead>
        <tbody>
          {faqs.map((faq) => (
            <tr key={faq.question} className={styles.faqRow}>
              <td>
                <Text>{faq.question}</Text>
              </td>
              <td>
                <Text color="secondary">{faq.answer}</Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Stack>
  );
}

function CapabilitiesSection() {
  return (
    <Stack direction="column" gap={2}>
      <Text element="h2" variant="h4" weight="medium">
        <Trans i18nKey="plugins.assistant-get-started.capabilities.heading">What Grafana Assistant can do</Trans>
      </Text>
      <Stack direction="column" gap={1}>
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.capabilities.item-analysis',
            'Data analysis and querying: Ask about performance, launch investigations, correlate metrics, logs, traces, profiles, and SQL data.'
          )}
        />
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.capabilities.item-dashboards',
            'Dashboard management: Create dashboards or refine existing panels, layouts, and variables.'
          )}
        />
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.capabilities.item-queries',
            'Query assistance: Build and refine PromQL, LogQL, TraceQL, SQL, and k6 queries with validation.'
          )}
        />
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.capabilities.item-navigation',
            'Navigation and discovery: Find dashboards, data sources, and tools without leaving the conversation.'
          )}
        />
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.capabilities.item-knowledge',
            'Knowledge and best practices: Get Grafana guidance and observability strategies in context.'
          )}
        />
      </Stack>
    </Stack>
  );
}

function RequirementsSection() {
  return (
    <Stack direction="column" gap={2}>
      <Text element="h2" variant="h4" weight="medium">
        <Trans i18nKey="plugins.assistant-get-started.requirements.heading">Requirements</Trans>
      </Text>
      <Stack direction="column" gap={1}>
        <FeatureItem text={t('plugins.assistant-get-started.requirements.item-version', 'Grafana 13.0.0 or later')} />
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.requirements.item-admin',
            'Organization administrator access (for installation and Cloud connection)'
          )}
        />
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.requirements.item-cloud',
            'A Grafana Cloud account (free tier available)'
          )}
        />
      </Stack>
    </Stack>
  );
}

function TryAskingSection({
  onOpenAssistant,
  disabled,
}: {
  onOpenAssistant: (props?: AssistantOpenOverrides) => void;
  disabled?: boolean;
}) {
  const styles = useStyles2(getStyles);

  const queries = [
    t('plugins.assistant-get-started.try-asking.query-datasources', 'What data sources do I have?'),
    t('plugins.assistant-get-started.try-asking.query-cpu', 'Show me CPU usage across my hosts'),
    t('plugins.assistant-get-started.try-asking.query-dashboard', 'Create a dashboard for my database'),
    t('plugins.assistant-get-started.try-asking.query-promql', 'Help me write a PromQL query for error rate'),
  ];

  return (
    <Stack direction="column" gap={2}>
      <Text element="h3" variant="h5" weight="medium">
        <Trans i18nKey="plugins.assistant-get-started.try-asking.heading">Try asking:</Trans>
      </Text>
      <div className={styles.tryQueriesGrid}>
        {queries.map((query) => (
          <button
            key={query}
            type="button"
            className={styles.tryQueryButton}
            disabled={disabled}
            onClick={() => onOpenAssistant({ prompt: query, autoSend: true })}
          >
            <Stack direction="row" gap={1} alignItems="center">
              <Icon name="comment-alt" />
              <Text>{query}</Text>
            </Stack>
          </button>
        ))}
      </div>
    </Stack>
  );
}

// --- Styles ---

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
  faqTable: css({
    width: '100%',
    borderCollapse: 'collapse',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  faqHeader: css({
    '& > th': {
      padding: theme.spacing(1.5, 2),
      backgroundColor: theme.colors.background.secondary,
      borderBottom: `2px solid ${theme.colors.border.medium}`,
      textAlign: 'left',
    },
  }),
  faqRow: css({
    '& > td': {
      padding: theme.spacing(1.5, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      verticalAlign: 'top',
    },
    '&:last-child > td': {
      borderBottom: 'none',
    },
  }),
  tryQueriesGrid: css({
    display: 'grid',
    gap: theme.spacing(1),
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    [theme.breakpoints.down('xl')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '1fr',
    },
  }),
  tryQueryButton: css({
    alignItems: 'center',
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    padding: theme.spacing(2),
    textAlign: 'left',
    width: '100%',
    '&:hover': {
      background: theme.colors.background.primary,
      borderColor: theme.colors.border.medium,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: 2,
    },
    '&:disabled': {
      cursor: 'not-allowed',
      opacity: 0.5,
    },
  }),
});

const getStepStyles = (theme: GrafanaTheme2) => {
  const stepNumberBase = css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: theme.shape.radius.circle,
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.bodySmall.fontSize,
    flexShrink: 0,
  });

  const cardBase = css({
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
  });

  return {
    card: css([
      cardBase,
      {
        border: `1px solid ${theme.colors.border.weak}`,
        backgroundColor: theme.colors.background.primary,
      },
    ]),
    cardDisabled: css([
      cardBase,
      {
        border: `1px solid ${theme.colors.border.weak}`,
        backgroundColor: theme.colors.background.primary,
        opacity: 0.45,
      },
    ]),
    stepNumber: css([
      stepNumberBase,
      { backgroundColor: theme.colors.primary.main, color: theme.colors.primary.contrastText },
    ]),
    stepNumberComplete: css([
      stepNumberBase,
      { backgroundColor: theme.colors.success.main, color: theme.colors.success.contrastText },
    ]),
    stepNumberDisabled: css([
      stepNumberBase,
      { backgroundColor: theme.colors.action.disabledBackground, color: theme.colors.text.disabled },
    ]),
  };
};
