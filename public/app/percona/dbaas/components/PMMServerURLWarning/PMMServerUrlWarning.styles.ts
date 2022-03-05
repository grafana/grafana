import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing, palette, typography, colors }: GrafanaTheme) => ({
  warningIcon: css`
    fill: ${palette.brandDanger};
    height: 30px;
    width: 30px;
    margin-right: ${spacing.sm};
  `,
  settingsLink: css`
    color: ${colors.linkExternal};
    &:hover {
      color: ${colors.linkExternal};
    }
  `,
  warningWrapper: css`
    align-items: center;
    display: flex;
    width: 100%;
  `,
  warningMessage: css`
    font-size: ${typography.size.md};
    margin-left: ${spacing.xs};
  `,
});
