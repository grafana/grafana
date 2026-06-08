import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

/**
 * Style for the large value number shared by the KPI stat cards (StatCard) and
 * the folder gauge card (FolderProgressCard), so the hero figure stays
 * consistent across both.
 */
export const getSharedCardStyles = (theme: GrafanaTheme2) => ({
  value: css({
    fontSize: theme.typography.pxToRem(28),
    lineHeight: 1.1,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.primary,
  }),
});
