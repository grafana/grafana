import { css, cx } from '@emotion/css';
import { Suspense } from 'react';

import { type ChatContextItem } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { Spinner, useStyles2 } from '@grafana/ui';

export const STANDALONE_PROMPT_COMPONENT_ID = 'grafana-assistant-app/standalone-prompt/v1';

/**
 * keep in sync with grafana-assistant-app `StandaloneAssistantPromptProps`
 */
interface StandalonePromptProps {
  onSubmit: (prompt: string, contextItems: ChatContextItem[]) => void;
  placeholder?: string;
  hideModeSelector?: boolean;
  mode?: string;
  className?: string;
}

interface DashboardLandingPromptProps {
  onSubmit: (prompt: string, contextItems: ChatContextItem[]) => void;
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
 * assistant plugin; this file configures the placeholder and dashboarding mode.
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
          placeholder ??
          t(
            'dashboard.empty.assistant-placeholder',
            'Describe your dashboard to the assistant. This will open the assistant chat and start a conversation.'
          )
        }
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
