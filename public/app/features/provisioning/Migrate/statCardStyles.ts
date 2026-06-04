import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

/**
 * Styles shared by the KPI stat cards (StatCard) and the folder gauge card
 * (FolderProgressCard): the card surface and the large value number. Kept in
 * one place so the card chrome stays consistent across both.
 */
export const getSharedCardStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
    background: theme.colors.background.secondary,
    alignItems: 'center',
    boxShadow: theme.shadows.z1,
  }),
  value: css({
    fontSize: theme.typography.pxToRem(44),
    lineHeight: 1.1,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.primary,
  }),
});
