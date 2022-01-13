import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors, typography, spacing }: GrafanaTheme) => ({
  breadcrumb: css`
    color: ${colors.textWeak};
    margin: ${spacing.lg} 0 64px;
    font-size: ${typography.heading.h2};
  `,
  currentPage: css`
    color: ${colors.text};
  `,
  link: css`
    font-size: ${typography.heading.h2};
    font-weight: ${typography.weight.regular};
    padding: 0;
    color: ${colors.textWeak};
    text-decoration: underline;

    &:hover,
    &:focus {
      color: ${colors.text};
      outline: none;
      text-decoration: none;
    }
  `,
});
