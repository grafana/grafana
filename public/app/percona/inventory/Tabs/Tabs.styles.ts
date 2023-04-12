import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme2) => ({
  detailsWrapper: css`
    display: flex;
    flex-direction: column;
  `,
  tagList: css`
    justify-content: flex-start;

    & > li {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
  actionPanel: css`
    display: flex;
    justify-content: flex-end;
    margin-bottom: 5px;
  `,
  confirmationText: css`
    margin-bottom: 2em;
  `,
  emptyMessage: css`
    height: 160px;
    display: flex;
    justify-content: center;
    align-items: center;
  `,
  overlay: css`
    height: 160px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: transparent;
  `,
  deleteItemTxtSpan: css`
    line-height: 15px;
  `,
  agentBreadcrumb: css`
    margin-top: ${spacing(4)};
    display: flex;

    & > span:first-child {
      max-width: 70%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  goBack: css`
    vertical-align: middle;
  `,
});
