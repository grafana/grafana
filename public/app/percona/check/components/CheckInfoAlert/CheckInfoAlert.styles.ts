import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ colors }: GrafanaTheme2) => ({
  link: css`
    color: ${colors.text.link};
    &:hover {
      color: ${colors.text.primary};
    }
  `,
  content: css`
    max-width: 80%;
  `,
});
