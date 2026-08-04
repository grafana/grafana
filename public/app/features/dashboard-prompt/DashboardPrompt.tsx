import { css } from '@emotion/css';

import { AssistantPromptCardView } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

import { PROMPT_ORIGIN } from './prompts';

interface Props {
  /** Receives the prompt as typed; the modal composes the request and hands it off. */
  onSubmitPrompt: (prompt: string) => void;
  /** Escape inside the prompt card closes the modal. */
  onDismiss: () => void;
}

/**
 * The modal's body: describe the dashboard, then hand off to the sidebar.
 * The question itself is the modal's title, so this only carries the subtext.
 */
export function DashboardPrompt({ onSubmitPrompt, onDismiss }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Text color="secondary">
        {t(
          'dashboard-prompt.prompt.description',
          'Describe it in your own words — mention the services, data, or questions you care about.'
        )}
      </Text>

      {/*
       * The SDK card owns the input and its submit affordance. We use the View
       * variant so opening the assistant stays ours: the modal hands off through
       * `startPlanningInAssistant`, which navigates to the new-dashboard editor
       * and attaches the planning instructions before opening the sidebar. The
       * card's own `openAssistant` is therefore a no-op and `onSubmit` — which
       * fires with the trimmed prompt — is what drives the handoff.
       */}
      <AssistantPromptCardView
        origin={PROMPT_ORIGIN}
        mode="dashboarding"
        placeholder={t(
          'dashboard-prompt.prompt.placeholder',
          'e.g. Error rates and latency for my checkout service, broken down by environment'
        )}
        examplePrompts={[]}
        openAssistant={() => {}}
        onSubmit={onSubmitPrompt}
        onClose={onDismiss}
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
  };
}
