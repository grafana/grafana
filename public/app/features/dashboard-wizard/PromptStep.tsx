import { css } from '@emotion/css';

import { type ChatContextItem } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Field, Stack, Text, TextArea, useStyles2 } from '@grafana/ui';

import { OptionCard } from './OptionCard';
import { WizardContextPicker } from './WizardContextPicker';
import { type WizardOption } from './types';

interface Props {
  freeText: string;
  onFreeTextChange: (value: string) => void;
  contextItems: ChatContextItem[];
  onAddContextItem: (item: ChatContextItem) => void;
  onRemoveContextItem: (item: ChatContextItem) => void;
  onSubmit: () => void;
  onShowMeWhatGrafanaCanDo: () => void;
  busy: boolean;
}

/** First wizard screen: describe the dashboard, or let the assistant show off. */
export function PromptStep({
  freeText,
  onFreeTextChange,
  contextItems,
  onAddContextItem,
  onRemoveContextItem,
  onSubmit,
  onShowMeWhatGrafanaCanDo,
  busy,
}: Props) {
  const styles = useStyles2(getStyles);

  const showMeOption: WizardOption = {
    id: 'show-me-what-grafana-can-do',
    title: t('dashboard-wizard.prompt-step.show-me', 'Just show me what Grafana can do'),
    description: t(
      'dashboard-wizard.prompt-step.show-me-description',
      'We will make assumptions based on your data and build a dashboard for you.'
    ),
    icon: 'ai-sparkle',
  };

  const canSubmit = !busy && freeText.trim() !== '';

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
          disabled={busy}
        />
      </Field>

      {/* Point the assistant at specific datasources, metrics, or dashboards. */}
      <WizardContextPicker
        items={contextItems}
        onAdd={onAddContextItem}
        onRemove={onRemoveContextItem}
        disabled={busy}
      />

      <Stack justifyContent="flex-end" alignItems="center" gap={1}>
        {busy && (
          <Text color="secondary">{t('dashboard-wizard.prompt-step.analyzing', 'Analyzing your request…')}</Text>
        )}
        <Button onClick={onSubmit} disabled={!canSubmit} icon={busy ? 'spinner' : 'ai-sparkle'}>
          {t('dashboard-wizard.prompt-step.build-it', 'Build it')}
        </Button>
      </Stack>

      <div className={styles.divider}>
        <Text color="secondary" variant="bodySmall">
          {t('dashboard-wizard.prompt-step.or', 'or')}
        </Text>
      </div>

      <OptionCard option={showMeOption} onClick={onShowMeWhatGrafanaCanDo} disabled={busy} />
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
    divider: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      '&::before, &::after': {
        content: '""',
        flex: 1,
        borderTop: `1px solid ${theme.colors.border.weak}`,
      },
    }),
  };
}
