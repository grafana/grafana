import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type PulseMention } from '../types';

interface Props {
  mention: PulseMention;
  onClick?: (mention: PulseMention) => void;
}

/**
 * MentionChip renders an @user or @panel reference. Clicking a panel
 * mention is wired by the parent (typically: scroll the dashboard to
 * that panel via the existing viewPanel URL key).
 *
 * Security: mentions render via React data binding (no inner HTML), the
 * displayName is server-provided and was schema-validated before
 * persistence. Even if a malicious displayName slipped through, the
 * worst it can do is render as text.
 */
export function MentionChip({ mention, onClick }: Props): ReactNode {
  const styles = useStyles2(getStyles);
  const label = mention.displayName ?? mention.targetId;
  const isPanel = mention.kind === 'panel';
  const className = isPanel ? styles.panel : styles.user;

  if (onClick) {
    return (
      <button type="button" className={className} onClick={() => onClick(mention)}>
        @{label}
      </button>
    );
  }
  return <span className={className}>@{label}</span>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  user: css({
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 2px',
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.primary.transparent,
    color: theme.colors.primary.text,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    border: 'none',
    cursor: 'inherit',
    whiteSpace: 'nowrap',
  }),
  panel: css({
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 2px',
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.warning.transparent,
    color: theme.colors.warning.text,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
});
