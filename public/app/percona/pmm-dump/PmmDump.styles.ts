import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { palette }, colors, spacing }: GrafanaTheme2) => ({
  overlay: css`
    height: 160px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: transparent;
  `,
  actionItemTxtSpan: css`
    line-height: 15px;
  `,
  createDatasetArea: css`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  `,
  actionButton: css`
    background: none;
    margin-right: 7px;
  `,
  serviceNamesTitle: css`
    font-weight: bold;
  `,
});
