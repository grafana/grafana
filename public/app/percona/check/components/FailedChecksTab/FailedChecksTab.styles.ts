import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

const headerPadding = '10px 0';

export const getStyles = ({ v1: { spacing, palette } }: GrafanaTheme2) => ({
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
  row: css`
    cursor: pointer;
    &:hover {
      background: ${palette.gray15};
    }
  `,
  cell: css`
    background: transparent !important;
  `,
});
