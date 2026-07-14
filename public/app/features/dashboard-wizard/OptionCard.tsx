import { css } from '@emotion/css';

import { type GrafanaTheme2, toIconName } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { type WizardOption } from './types';

interface Props {
  option: WizardOption;
  onClick: (option: WizardOption) => void;
  disabled?: boolean;
  selected?: boolean;
}

/** A selectable card for a wizard option (entity type, simple idea, or dashboard candidate). */
export function OptionCard({ option, onClick, disabled, selected }: Props) {
  const styles = useStyles2(getStyles);
  const icon = toIconName(option.icon ?? '') ?? 'chart-line';

  return (
    <button
      type="button"
      className={selected ? `${styles.card} ${styles.cardSelected}` : styles.card}
      onClick={() => onClick(option)}
      disabled={disabled}
      aria-pressed={selected}
    >
      <Icon name={icon} size="lg" className={styles.icon} />
      <div className={styles.texts}>
        <div className={styles.title}>{option.title}</div>
        {option.description && <div className={styles.description}>{option.description}</div>}
      </div>
    </button>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    card: css({
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(1.5),
      width: '100%',
      textAlign: 'left',
      padding: theme.spacing(1.5),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      '&:hover:not(:disabled)': {
        background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
        borderColor: theme.colors.border.medium,
      },
      '&:disabled': {
        cursor: 'not-allowed',
        opacity: 0.6,
      },
    }),
    cardSelected: css({
      borderColor: theme.colors.primary.border,
      background: theme.colors.primary.transparent,
      '&:hover:not(:disabled)': {
        borderColor: theme.colors.primary.border,
        background: theme.colors.primary.transparent,
      },
    }),
    icon: css({
      flexShrink: 0,
      marginTop: theme.spacing(0.25),
      color: theme.colors.primary.text,
    }),
    texts: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      minWidth: 0,
    }),
    title: css({
      fontWeight: theme.typography.fontWeightMedium,
    }),
    description: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
