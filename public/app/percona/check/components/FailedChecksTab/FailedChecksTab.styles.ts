import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

const headerPadding = '10px 0';

export const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  spinner: css`
    display: flex;
    height: 10em;
    align-items: center;
    justify-content: center;
  `,
  header: css`
    align-items: center;
    display: flex;
    justify-content: space-between;
  `,
  runChecksButton: css`
    width: 140px;
    align-items: center;
    display: flex;
    flex-direction: column;
  `,
  actionButtons: css`
    display: flex;
    flex: 1;
    justify-content: flex-end;
    padding: ${headerPadding};
    align-items: center;
  `,
  showAll: css`
    display: flex;
    align-items: center;
    margin-right: ${theme.spacing.xl};

    span {
      margin-left: ${theme.spacing.sm};
    }
  `,
}));
