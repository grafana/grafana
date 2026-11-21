import { css } from '@emotion/css';

import { useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Button, Combobox, Stack, Text, useStyles2 } from '@grafana/ui';

import { DETECTED_SCOPE, type Scope, SCOPE_VALUES } from '../mockScenario';

import { AssistantIcon } from './AssistantIcon';

const SCOPE_ATTRIBUTES: Record<Scope['type'], string> = {
  service: 'service.name',
  environment: 'deployment.environment',
  namespace: 'k8s.namespace.name',
};

interface Props {
  scope: Scope;
  // Set when Grafana Assistant picked the scope from a hint, rather than the user picking it.
  detected: boolean;
  onChangeScope: (scope: Scope) => void;
  onReset: () => void;
}

export function DrilldownScopeSummary({ scope, detected, onChangeScope, onReset }: Props) {
  const styles = useStyles2(getStyles);
  const { isAvailable, openAssistant } = useAssistant();

  // The cause is already known, so the next step is acting on it rather than typing a question.
  const onAskForFix = () =>
    openAssistant?.({
      origin: 'grafana/drilldown-home',
      prompt: t('drilldown-page.scope.fix-prompt', 'Likely cause on {{service}}: {{cause}} How do I fix it?', {
        service: scope.value,
        cause: DETECTED_SCOPE.likelyCause,
      }),
      autoSend: true,
    });

  return (
    <section className={styles.summary}>
      <Stack justifyContent="space-between" alignItems="center" wrap="wrap" gap={1}>
        <Stack alignItems="center" gap={1} wrap="wrap">
          <Text variant="bodySmall" color="secondary">
            {detected
              ? t('drilldown-page.scope.detected', 'Scope chosen by Grafana Assistant')
              : t('drilldown-page.scope.manual', 'Scope')}
          </Text>
          {/* The scope is changed where it is shown: the chosen value is itself a picker. */}
          <Stack gap={0.5} alignItems="center">
            <Text variant="code" color="secondary">
              {t('drilldown-page.scope.attribute-label', '{{attribute}} =', {
                attribute: SCOPE_ATTRIBUTES[scope.type],
              })}
            </Text>
            <Combobox
              width="auto"
              minWidth={12}
              options={SCOPE_VALUES[scope.type].map((value) => ({ value }))}
              value={scope.value}
              aria-label={t('drilldown-page.scope.change-label', 'Change {{attribute}}', {
                attribute: SCOPE_ATTRIBUTES[scope.type],
              })}
              onChange={(option) => onChangeScope({ type: scope.type, value: option.value })}
            />
          </Stack>
          <Badge
            color="darkgrey"
            text={t('drilldown-page.scope.environment', 'deployment.environment = {{environment}}', {
              environment: DETECTED_SCOPE.environment,
            })}
          />
          <Badge
            color="darkgrey"
            text={t('drilldown-page.scope.since', 'since {{since}}', { since: DETECTED_SCOPE.since })}
          />
        </Stack>
        <Button size="sm" variant="secondary" fill="text" icon="arrow-left" onClick={onReset}>
          {t('drilldown-page.scope.back', 'Back to overview')}
        </Button>
      </Stack>
      {detected && (
        <Stack justifyContent="space-between" alignItems="center" gap={2} wrap="wrap">
          <Stack alignItems="flex-start" gap={1}>
            <span className={styles.icon}>
              <AssistantIcon />
            </span>
            <Text>
              <Text weight="medium">{t('drilldown-page.scope.likely-cause', 'Likely cause:')}</Text>{' '}
              {DETECTED_SCOPE.likelyCause}
            </Text>
          </Stack>
          <Button size="sm" icon="ai-sparkle" disabled={!isAvailable} onClick={onAskForFix}>
            {t('drilldown-page.scope.ask-for-fix', 'Ask Assistant for a fix')}
          </Button>
        </Stack>
      )}
    </section>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  summary: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  icon: css({
    display: 'inline-flex',
    marginTop: theme.spacing(0.25),
  }),
});
