import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const { spacing } = theme;

  return {
    resourcesWrapper: css`
      display: flex;
      div {
        margin-right: ${spacing.xl};
        white-space: nowrap;
        width: 100px;
      }
    `,
    nodesWrapper: css`
      margin-bottom: ${spacing.md};
      width: 60px;
      div,
      label {
        white-space: nowrap;
      }
    `,
  };
});
