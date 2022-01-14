import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

export const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrapper: css`
    max-width: 300px;
    text-align: center;
  `,
  title: css`
    color: ${(theme.colors as any).formLegend};
    font-size: ${theme.typography.heading.h4};
    font-weight: ${theme.typography.weight.regular};
    margin: ${(theme.spacing as any).formLegendMargin};
    text-align: center;
  `,
  email: css`
    margin: 20px 0;
  `,
}));
