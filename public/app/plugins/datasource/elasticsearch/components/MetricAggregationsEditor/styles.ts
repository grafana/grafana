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
