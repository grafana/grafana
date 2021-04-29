import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = ({ spacing, typography }: GrafanaTheme) => ({
  detailsWrapper: css`
    display: flex;

    & > span {
      flex: 0 1 33.33%;
    }
  `,
  detailLabel: css`
    margin-right: ${spacing.md};
    font-weight: ${typography.weight.semibold};
  `,
});
