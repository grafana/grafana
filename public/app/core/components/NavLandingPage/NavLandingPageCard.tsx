import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, useStyles2 } from '@grafana/ui';

interface Props {
  description?: string;
  text: string;
  url: string;
  category?: string;
  onClick?: (event?: React.MouseEvent) => void;
}

const CATEGORY_STYLES = ['primary', 'secondary', 'success', 'warning', 'error'] as const;
type CategoryStyle = (typeof CATEGORY_STYLES)[number];

function isCategoryStyle(cat: string): cat is CategoryStyle {
  return CATEGORY_STYLES.some((style) => style === cat);
}

export function NavLandingPageCard({ description, text, url, category, onClick }: Props) {
  const styles = useStyles2(getStyles);

  const categoryClass = category && isCategoryStyle(category) ? styles[category] : undefined;

  return (
    <Card noMargin className={cx(styles.card, categoryClass)} href={url} onClick={onClick}>
      <Card.Heading>{text}</Card.Heading>
      <Card.Description className={styles.description}>{description}</Card.Description>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    gridTemplateRows: '1fr 0 2fr',
  }),
  // Limit descriptions to 3 lines max before ellipsing
  // Some plugin descriptions can be very long
  description: css({
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    display: '-webkit-box',
    overflow: 'hidden',
  }),
  // Category-based styling
  primary: css({
    border: `1px solid ${theme.colors.primary.borderTransparent}`,
    backgroundColor: theme.colors.primary.transparent,
    '&:hover': {
      backgroundColor: theme.colors.primary.transparent,
      borderColor: theme.colors.primary.border,
    },
  }),
  secondary: css({
    border: `1px solid ${theme.colors.secondary.borderTransparent}`,
    backgroundColor: theme.colors.secondary.transparent,
    '&:hover': {
      backgroundColor: theme.colors.secondary.transparent,
      borderColor: theme.colors.secondary.border,
    },
  }),
  success: css({
    border: `1px solid ${theme.colors.success.borderTransparent}`,
    backgroundColor: theme.colors.success.transparent,
    '&:hover': {
      backgroundColor: theme.colors.success.transparent,
      borderColor: theme.colors.success.border,
    },
  }),
  warning: css({
    border: `1px solid ${theme.colors.warning.borderTransparent}`,
    backgroundColor: theme.colors.warning.transparent,
    '&:hover': {
      backgroundColor: theme.colors.warning.transparent,
      borderColor: theme.colors.warning.border,
    },
  }),
  error: css({
    border: `1px solid ${theme.colors.error.borderTransparent}`,
    backgroundColor: theme.colors.error.transparent,
    '&:hover': {
      backgroundColor: theme.colors.error.transparent,
      borderColor: theme.colors.error.border,
    },
  }),
});
