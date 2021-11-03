import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = ({ colors, spacing }: GrafanaTheme) => ({
  content: css`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
  `,
  infoWrapper: css`
    display: flex;
    flex-direction: column;
    background-color: ${colors.bg2};
    padding: ${spacing.sm};
    margin-top: ${spacing.md};
    margin-bottom: ${spacing.md};
  `,
  infoItems: css`
    list-style-position: inside;
    margin-left: ${spacing.sm};
  `,
});
