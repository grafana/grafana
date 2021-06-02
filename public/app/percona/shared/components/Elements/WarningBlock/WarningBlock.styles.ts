import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = ({ colors, spacing }: GrafanaTheme) => ({
  warningWrapper: css`
    display: flex;
    align-items: center;
    background-color: ${colors.bg2};
    padding: ${spacing.sm};
    margin-bottom: ${spacing.xl};
  `,
  warningIcon: css`
    margin-right: ${spacing.sm};
  `,
});
