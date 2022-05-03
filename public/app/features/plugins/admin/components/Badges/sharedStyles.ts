import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getBadgeColor = (theme: GrafanaTheme2) => css`
  background: ${theme.colors.background.primary};
  border-color: ${theme.colors.border.strong};
  color: ${theme.colors.text.secondary};
`;
