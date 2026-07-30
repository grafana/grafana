import { css } from '@emotion/css';

import { AssistantPromptCardView, type ChatContextItem } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { WizardContextPicker } from './WizardContextPicker';
import { WIZARD_ORIGIN } from './prompts';

interface Props {
  contextItems: ChatContextItem[];
  onAddContextItem: (item: ChatContextItem) => void;
  onRemoveContextItem: (item: ChatContextItem) => void;
  /** Receives the prompt as typed; the modal composes the request and hands it off. */
  onSubmitPrompt: (prompt: string) => void;
  /** Escape inside the prompt card closes the wizard. */
  onDismiss: () => void;
}

/** First wizard screen: describe the dashboard, attach context, hand off to the sidebar. */
export function PromptStep({ contextItems, onAddContextItem, onRemoveContextItem, onSubmitPrompt, onDismiss }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={0.5}>
        <Text element="h4" variant="h5">
          {t('dashboard-wizard.prompt-step.title', 'What do you want to monitor?')}
        </Text>
        <Text color="secondary">
          {t(
            'dashboard-wizard.prompt-step.description',
            'Describe it in your own words — mention the services, data, or questions you care about.'
          )}
        </Text>
      </Stack>

      {/* Point the assistant at specific datasources, metrics, or dashboards. */}
      <WizardContextPicker items={contextItems} onAdd={onAddContextItem} onRemove={onRemoveContextItem} />

      {/*
       * The SDK card owns the input and its submit affordance. We use the View
       * variant so its `openAssistant` is ours: the wizard hands off through
       * `startPlanningInAssistant`, which navigates to the new-dashboard editor
       * and attaches the planning instructions before opening the sidebar.
       */}
      <AssistantPromptCardView
        origin={WIZARD_ORIGIN}
        mode="dashboarding"
        placeholder={t(
          'dashboard-wizard.prompt-step.placeholder',
          'e.g. Error rates and latency for my checkout service, broken down by environment'
        )}
        examplePrompts={[]}
        openAssistant={({ prompt }) => {
          if (prompt) {
            onSubmitPrompt(prompt);
          }
        }}
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
