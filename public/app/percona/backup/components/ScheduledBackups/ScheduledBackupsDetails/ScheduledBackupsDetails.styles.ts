import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = ({ spacing, typography }: GrafanaTheme) => ({
  detailsWrapper: css`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    margin-top: -${spacing.md};

    & > * {
      flex: 1 0 50%;

      &:not(:last-child) {
        margin-top: ${spacing.md};
      }
    }
  `,
  detailLabel: css`
    margin-right: ${spacing.md};
    font-weight: ${typography.weight.semibold};
  `,
});
