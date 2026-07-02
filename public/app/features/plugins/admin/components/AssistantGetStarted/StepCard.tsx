import { css } from '@emotion/css';
import { type JSX } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { type SetupState } from './constants';

export type StepState = 'complete' | 'active' | 'disabled';

export function getStepState(setupState: SetupState, step: number): StepState {
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

export function StepCard({
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
