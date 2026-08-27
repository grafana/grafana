import { css, cx } from '@emotion/css';
import { Suspense } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { Spinner, useStyles2 } from '@grafana/ui';

import { type DashboardLandingPromptSelection } from './types';

export const STANDALONE_PROMPT_COMPONENT_ID = 'grafana-assistant-app/standalone-prompt/v1';

/** + menu sections this Grafana surface allows in the prompt picker. */
const DASHBOARD_PROMPT_CONTEXT_SECTIONS = ['datasources', 'dashboards'] as const;

interface StandalonePromptProps {
  onSubmit: (prompt: string, selection: DashboardLandingPromptSelection[]) => void;
  placeholder?: string;
  includeContextSections?: readonly string[];
  hideModeSelector?: boolean;
  mode?: string;
  className?: string;
}

interface DashboardLandingPromptProps {
  onSubmit: (prompt: string, selection: DashboardLandingPromptSelection[]) => void;
  placeholder?: string;
  className?: string;
}

function PromptLoadingSlot() {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.slot, styles.loadingSlot)} data-testid="dashboard-landing-prompt-slot">
      <Spinner size="xl" />
    </div>
  );
}

/**
 * Grafana host for the new-dashboard prompt. ChatInput itself lives in the
 * assistant plugin; this file is the dashboard-domain configuration: placeholder,
 * dashboarding mode, and a + menu limited to dashboards and data sources.
 */
export function DashboardLandingPrompt({ onSubmit, placeholder }: DashboardLandingPromptProps) {
  const { component: Prompt, isLoading } = usePluginComponent<StandalonePromptProps>(STANDALONE_PROMPT_COMPONENT_ID);

  if (!Prompt) {
    return isLoading ? <PromptLoadingSlot /> : null;
  }

  return (
    <Suspense fallback={<PromptLoadingSlot />}>
      <Prompt
        onSubmit={onSubmit}
        placeholder={
          placeholder ?? t('dashboard.empty.assistant-placeholder', 'Describe your dashboard to the assistant')
        }
        includeContextSections={DASHBOARD_PROMPT_CONTEXT_SECTIONS}
        hideModeSelector
        mode="dashboarding"
      />
    </Suspense>
  );
}

function getStyles(_theme: GrafanaTheme2) {
  return {
    slot: css({
      width: '100%',
      height: 100,
    }),
    loadingSlot: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
  };
}
