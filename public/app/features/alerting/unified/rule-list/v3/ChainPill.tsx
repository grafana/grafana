import { css, cx } from '@emotion/css';
import { type MouseEvent } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

interface ChainPillProps {
  chainId: string;
  chainName: string;
  position: number;
  total: number;
  active?: boolean;
  onClick: (chainId: string, position: number) => void;
}

export function ChainPill({ chainId, chainName, position, total, active, onClick }: ChainPillProps) {
  const styles = useStyles2(getStyles);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onClick(chainId, position);
  }

  return (
    <button
      type="button"
      className={cx(styles.pill, active && styles.active)}
      onClick={handleClick}
      aria-label={t('alerting.rule-list-v3.chain-pill-label', 'Chain: {{name}}, position {{position}} of {{total}}', {
        name: chainName,
        position,
        total,
      })}
    >
      <Icon name="link" size="xs" />
      <span>{chainName}</span>
      <span className={styles.separator} aria-hidden>
        ·
      </span>
      <span className={styles.position}>
        {position}/{total}
      </span>
    </button>
  );
}

function getStyles(theme: GrafanaTheme2) {
  const primary = theme.colors.primary;

  return {
    pill: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: `${theme.spacing(0.25)} ${theme.spacing(1)} ${theme.spacing(0.25)} ${theme.spacing(0.75)}`,
      borderRadius: theme.shape.radius.pill,
      border: `1px solid ${primary.border}`,
      background: primary.transparent,
      color: primary.text,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1,
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create(['background', 'border-color'], { duration: 120 }),
      },
      '&:hover': {
        background: primary.main,
        color: primary.contrastText,
        borderColor: primary.main,
      },
      '&:focus-visible': {
        outline: `2px solid ${primary.main}`,
        outlineOffset: '1px',
      },
    }),
    active: css({
      background: primary.main,
      color: primary.contrastText,
      borderColor: primary.main,
    }),
    separator: css({
      color: theme.colors.text.secondary,
    }),
    position: css({
      color: theme.colors.text.secondary,
    }),
  };
}
