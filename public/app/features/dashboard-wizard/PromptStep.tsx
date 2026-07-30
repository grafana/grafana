import { css } from '@emotion/css';

import { type ChatContextItem } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Field, Stack, TextArea, useStyles2 } from '@grafana/ui';

import { WizardContextPicker } from './WizardContextPicker';

interface Props {
  freeText: string;
  onFreeTextChange: (value: string) => void;
  contextItems: ChatContextItem[];
  onAddContextItem: (item: ChatContextItem) => void;
  onRemoveContextItem: (item: ChatContextItem) => void;
  onSubmit: () => void;
}

/** First wizard screen: describe the dashboard and hand it to the assistant. */
export function PromptStep({
  freeText,
  onFreeTextChange,
  contextItems,
  onAddContextItem,
  onRemoveContextItem,
  onSubmit,
}: Props) {
  const styles = useStyles2(getStyles);

  const canSubmit = freeText.trim() !== '';

  return (
    <div className={styles.container}>
      <Field
        label={t('dashboard-wizard.prompt-step.title', 'What do you want to monitor?')}
        description={t(
          'dashboard-wizard.prompt-step.description',
          'Describe it in your own words — mention the services, data, or questions you care about.'
        )}
        noMargin
      >
        <TextArea
          value={freeText}
          onChange={(e) => onFreeTextChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSubmit) {
                onSubmit();
              }
            }
          }}
          placeholder={t(
            'dashboard-wizard.prompt-step.placeholder',
            'e.g. Error rates and latency for my checkout service, broken down by environment'
          )}
          rows={4}
        />
      </Field>

      {/* Point the assistant at specific datasources, metrics, or dashboards. */}
      <WizardContextPicker items={contextItems} onAdd={onAddContextItem} onRemove={onRemoveContextItem} />

      <Stack justifyContent="flex-end" alignItems="center" gap={1}>
        <Button onClick={onSubmit} disabled={!canSubmit} icon="ai-sparkle">
          {t('dashboard-wizard.prompt-step.build-it', 'Build it')}
        </Button>
      </Stack>
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
