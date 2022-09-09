import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ colors, v1: { colors: v1Colors, spacing } }: GrafanaTheme2) => {
  return {
    disabledRow: css`
      background-color: ${colors.action.disabledBackground} !important;
      opacity: ${colors.action.disabledOpacity};
    `,
    silencedSeverity: css`
      color: inherit;
    `,
    ruleLink: css`
      color: ${colors.text.link};
    `,
  };
};
