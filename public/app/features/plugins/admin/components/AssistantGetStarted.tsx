/**
 * Custom Overview page for the Grafana Assistant plugin.
 * Renders a guided onboarding flow instead of the standard plugin readme.
 *
 * TODO: i18n — wrap user-facing strings with t()/Trans once copy is finalized.
 * Tracking: https://github.com/grafana/grafana/issues/XXXXX
 */
/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';
import { useState, type JSX } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { useAssistant, type OpenAssistantProps } from '@grafana/assistant';
import { type GrafanaTheme2, type GrafanaPlugin } from '@grafana/data';
import { Badge, Box, Button, Icon, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { useInstall, useInstallStatus } from '../state/hooks';
import { type CatalogPlugin } from '../types';

/** Plugin ID constant — also used in PluginDetailsBody.tsx and usePluginDetailsTabs.tsx */
export const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';

type SetupState = 'not-installed' | 'reloading' | 'not-connected' | 'connected';
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
  if (loading || !pluginConfig) {
    return 'not-connected';
  }
  if (!pluginConfig.meta.enabled) {
    return 'not-connected';
  }
  return 'connected';
}

function isSetupState(value: string): value is SetupState {
  return ['not-installed', 'reloading', 'not-connected', 'connected'].includes(value);
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
  const [installedReloading, setInstalledReloading] = useState(false);
  const canInstall = contextSrv.hasPermission(AccessControlAction.PluginsInstall);
  const location = useLocation();

  // Dev-only: override state via ?devState=not-installed|reloading|not-connected|connected
  const devStateParam = new URLSearchParams(location.search).get('devState');
  const devState = devStateParam && isSetupState(devStateParam) ? devStateParam : null;

  const state =
    devState ?? (installedReloading ? 'reloading' : getSetupState(plugin, pluginConfig, pluginConfigLoading));

  const handleInstall = async () => {
    try {
      const result = await installPlugin(plugin.id);
      if (!('error' in result)) {
        setInstalledReloading(true);
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error) {
      // Install/fetch errors are surfaced by Redux toast notifications
      console.error('Failed to install assistant plugin:', error);
    }
  };

  const handleOpenAssistant = (props?: AssistantOpenOverrides) => {
    openAssistant?.({
      origin: 'grafana/plugins/admin/assistant-get-started',
      ...props,
    });
  };

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={2}>
        <Text element="h2" variant="h4" weight="medium">
          Set up in 3 steps
        </Text>
        <div className={styles.stepsGrid} aria-label="Setup steps">
          <StepCard
            number={1}
            title={state === 'reloading' ? 'Installed! Loading plugin...' : 'Install the plugin'}
            description={
              state === 'reloading'
                ? 'The page will refresh automatically.'
                : !canInstall && state === 'not-installed'
                  ? 'An administrator needs to install this plugin.'
                  : "You're already here! Click Install to add the Grafana Assistant plugin to your instance."
            }
            state={getStepState(state, 1)}
            action={
              state === 'not-installed' && canInstall ? (
                <Button size="sm" onClick={handleInstall} disabled={isInstalling}>
                  {isInstalling ? 'Installing...' : 'Install'}
                </Button>
              ) : undefined
            }
          />
          <StepCard
            number={2}
            title="Connect to Grafana Cloud"
            description="Sign in or create a free Grafana Cloud account to enable AI-powered assistance."
            state={getStepState(state, 2)}
            action={
              getStepState(state, 2) === 'active' ? (
                <LinkButton
                  size="sm"
                  href="https://grafana.com/auth/sign-up/?utm_source=grafana_oss&utm_medium=onprem_assistant&utm_campaign=assistant_onboarding&cta=connect_step2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Connect
                </LinkButton>
              ) : undefined
            }
          />
          <StepCard
            number={3}
            title="Start a conversation"
            description="Click the Assistant icon in the sidebar. Ask about your data sources, build queries, or create dashboards."
            state={getStepState(state, 3)}
            action={
              getStepState(state, 3) === 'active' ? (
                <Button size="sm" onClick={() => handleOpenAssistant()}>
                  Open Assistant
                </Button>
              ) : undefined
            }
          />
        </div>
      </Stack>

      {state === 'connected' && <TryAskingSection onOpenAssistant={handleOpenAssistant} />}

      <IncludedFreePanel />
      <DataAccessSection />
      <CapabilitiesSection />
      <RequirementsSection />
    </div>
  );
}

// --- Step state logic ---

type StepState = 'complete' | 'active' | 'warning' | 'disabled';

function getStepState(setupState: SetupState, step: number): StepState {
  switch (setupState) {
    case 'not-installed':
      return step === 1 ? 'active' : 'disabled';
    case 'reloading':
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
      : state === 'warning'
        ? styles.stepNumberWarning
        : state === 'disabled'
          ? styles.stepNumberDisabled
          : styles.stepNumber;

  const cardClass = state === 'disabled' ? styles.cardDisabled : state === 'warning' ? styles.cardWarning : styles.card;

  const stepLabel =
    state === 'complete'
      ? `Step ${number}: complete`
      : state === 'warning'
        ? `Step ${number}: action needed`
        : `Step ${number}`;

  return (
    <div className={cardClass} aria-label={stepLabel}>
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={1.5} alignItems="center">
          <div className={stepNumberClass} aria-hidden="true">
            {state === 'complete' ? (
              <Icon name="check" size="sm" />
            ) : state === 'warning' ? (
              <span>!</span>
            ) : (
              <span>{number}</span>
            )}
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
        Included free, no credit card required
      </Text>
      <Box backgroundColor="secondary" borderColor="weak" borderStyle="solid" padding={3}>
        <Stack direction="column" gap={2}>
          <div>
            <Badge text="Included free" color="green" icon="ai-sparkle" />
          </div>
          <Text color="secondary">
            Grafana Assistant is included in the Grafana Cloud forever free plan with generous limits so you can get
            started right away.
          </Text>
          <Stack direction="column" gap={1}>
            <FeatureItem text="Free access for your team on Grafana Cloud" />
            <FeatureItem text="Generous usage for getting started" />
            <FeatureItem text="Natural language to PromQL, LogQL, TraceQL, and SQL" />
            <FeatureItem text="Dashboard creation and editing" />
            <FeatureItem text="Alert investigation and troubleshooting" />
            <FeatureItem text="Navigation and discovery assistance" />
          </Stack>
          <Text color="secondary" variant="bodySmall">
            Need more capacity or advanced plan features?{' '}
            <TextLink href="https://grafana.com/pricing/" external>
              View pricing plans →
            </TextLink>
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
      question: 'Is my data sent to third parties?',
      answer: 'No. Queries are processed by Grafana Labs infrastructure. All communication is encrypted in transit.',
    },
    {
      question: 'Does this work with RBAC?',
      answer:
        'Yes. The Assistant respects your existing role-based access control. Users only see resources they have access to.',
    },
    {
      question: 'Can non-admin users use it?',
      answer:
        'Yes, once an admin has installed the plugin and connected to Cloud, any user in the org can use the Assistant based on their existing permissions.',
    },
    {
      question: 'Is this available for self-managed Grafana?',
      answer: "Yes — that's exactly what this setup flow is for.",
    },
  ];

  return (
    <Stack direction="column" gap={2}>
      <Text element="h2" variant="h4" weight="medium">
        What data does the Assistant access?
      </Text>
      <Text color="secondary">
        The Assistant reads <strong>metadata and schema only</strong> — dashboard names, panel titles, data source
        types, and metric/label names. It never reads your actual metric data or query results.
      </Text>
      <table className={styles.faqTable} role="table">
        <thead>
          <tr className={styles.faqHeader}>
            <th>
              <Text weight="medium">Question</Text>
            </th>
            <th>
              <Text weight="medium">Answer</Text>
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
        What Grafana Assistant can do
      </Text>
      <Stack direction="column" gap={1}>
        <FeatureItem text="Data analysis and querying: Ask about performance, launch investigations, correlate metrics, logs, traces, profiles, and SQL data." />
        <FeatureItem text="Dashboard management: Create dashboards or refine existing panels, layouts, and variables." />
        <FeatureItem text="Query assistance: Build and refine PromQL, LogQL, TraceQL, SQL, and k6 queries with validation." />
        <FeatureItem text="Navigation and discovery: Find dashboards, data sources, and tools without leaving the conversation." />
        <FeatureItem text="Knowledge and best practices: Get Grafana guidance and observability strategies in context." />
      </Stack>
    </Stack>
  );
}

function RequirementsSection() {
  return (
    <Stack direction="column" gap={2}>
      <Text element="h2" variant="h4" weight="medium">
        Requirements
      </Text>
      <Stack direction="column" gap={1}>
        <FeatureItem text="Grafana 13.0.0 or later" />
        <FeatureItem text="Organization administrator access (for installation and Cloud connection)" />
        <FeatureItem text="A Grafana Cloud account (free tier available)" />
      </Stack>
    </Stack>
  );
}

function TryAskingSection({ onOpenAssistant }: { onOpenAssistant: (props?: AssistantOpenOverrides) => void }) {
  const styles = useStyles2(getStyles);

  const queries = [
    'What data sources do I have?',
    'Show me CPU usage across my hosts',
    'Create a dashboard for my database',
    'Help me write a PromQL query for error rate',
  ];

  return (
    <Stack direction="column" gap={2}>
      <Text element="h3" variant="h5" weight="medium">
        Try asking:
      </Text>
      <div className={styles.tryQueriesGrid}>
        {queries.map((query) => (
          <button
            key={query}
            type="button"
            className={styles.tryQueryButton}
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
    cardWarning: css([
      cardBase,
      {
        border: `1px solid ${theme.colors.warning.border}`,
        backgroundColor: theme.colors.warning.transparent,
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
    stepNumberWarning: css([
      stepNumberBase,
      { backgroundColor: theme.colors.warning.main, color: theme.colors.warning.contrastText },
    ]),
    stepNumberDisabled: css([
      stepNumberBase,
      { backgroundColor: theme.colors.action.disabledBackground, color: theme.colors.text.disabled },
    ]),
  };
};
