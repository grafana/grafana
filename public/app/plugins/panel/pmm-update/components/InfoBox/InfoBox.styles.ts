import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ colors, spacing }: GrafanaTheme2) => ({
  infoBox: css`
    margin: 10px 0;
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
    border: 1px solid #292929;
    text-align: center;
    padding: ${spacing(0.5)};
  `,
  link: css`
    color: ${colors.text.link};

    &:hover {
      color: ${colors.primary.text};
    }
  `,
});
