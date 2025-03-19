// @PERCONA

import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  deleteWarning: css({
    marginTop: spacing.lg,
  }),
});
