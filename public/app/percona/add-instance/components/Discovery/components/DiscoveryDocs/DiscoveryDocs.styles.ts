import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = ({ colors, spacing }: GrafanaTheme) => ({
  infoWrapper: css`
    display: flex;
    flex-direction: column;
    background-color: ${colors.bg2};
    padding: ${spacing.sm};
    margin-top: ${spacing.md};
    margin-bottom: ${spacing.md};
    button {
      height: 100%;
      span {
        white-space: break-spaces;
      }
    }
  `,
  infoItems: css`
    list-style-position: inside;
    margin-left: ${spacing.sm};
  `,
});
