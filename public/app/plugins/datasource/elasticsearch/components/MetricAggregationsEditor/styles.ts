import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { css } from 'emotion';

export const getStyles = stylesFactory((theme: GrafanaTheme, hidden: boolean) => {
  return {
    // FIXME: Check this when doing options
    color: css`
      &,
      &:hover,
      label,
      a {
        color: ${hidden ? theme.colors.textFaint : theme.colors.text};
      }
    `,
  };
});

export const flex = css`
  display: flex;
`;

export const flexRow = css`
  flex-direction: row;
`;

export const flexColumn = css`
  flex-direction: column;
`;

export const justifyStart = css`
  justify-content: start;
`;

export const alignItemsStart = css`
  align-items: start;
`;
