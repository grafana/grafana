import { css, cx } from '@emotion/css';
import { type ReactNode, Suspense, useCallback } from 'react';

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
  /** A promise that rejects keeps the prompt's text and pills. Older plugin versions do not wait on it. */
  onSubmit: (prompt: string, contextItems: ChatContextItem[]) => void | Promise<void>;
  placeholder?: string;
  hideModeSelector?: boolean;
  mode?: string;
  className?: string;
  /** Context attached from outside the prompt, shown as pills. Older plugin versions ignore it. */
  hostContextItems?: ChatContextItem[];
  onHostContextItemRemove?: (id: string) => void;
  /**
   * Controls shown next to the prompt's + button. A function, since the props reach the plugin deep-cloned and an
   * element does not survive the clone. Older plugin versions do not show them.
   */
  renderHostActions?: () => ReactNode;
}

interface DashboardLandingPromptProps {
  onSubmit: (prompt: string, contextItems: ChatContextItem[]) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  hostContextItems?: ChatContextItem[];
  onHostContextItemRemove?: (id: string) => void;
  renderHostActions?: () => ReactNode;
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
export function DashboardLandingPrompt({
  onSubmit,
  placeholder,
  hostContextItems,
  onHostContextItemRemove,
  renderHostActions,
}: DashboardLandingPromptProps) {
  const { component: Prompt, isLoading } = usePluginComponent<StandalonePromptProps>(STANDALONE_PROMPT_COMPONENT_ID);
  const submit = useCallback(
    (prompt: string, contextItems: ChatContextItem[]) => {
      const result = onSubmit(prompt, contextItems);
      // An older plugin drops the promise, so its rejection must not surface as unhandled.
      result?.catch(() => {});
      return result;
    },
    [onSubmit]
  );

  if (!Prompt) {
    return isLoading ? <PromptLoadingSlot /> : null;
  }

  return (
    <Suspense fallback={<PromptLoadingSlot />}>
      <Prompt
        onSubmit={submit}
        placeholder={
          placeholder ??
          t(
            'dashboard.empty.assistant-placeholder',
            'Describe your dashboard. This will open the assistant chat and start a conversation.'
          )
        }
        hideModeSelector
        mode="dashboarding"
        hostContextItems={hostContextItems}
        onHostContextItemRemove={onHostContextItemRemove}
        renderHostActions={renderHostActions}
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
