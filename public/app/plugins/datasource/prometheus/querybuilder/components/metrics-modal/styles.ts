import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2, disableTextWrap: boolean) => {
  return {
    modal: css`
      width: 85vw;
      ${theme.breakpoints.down('md')} {
        width: 100%;
      }
      ${theme.breakpoints.up('xl')} {
        width: 60%;
      }
    `,
    inputWrapper: css`
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: ${theme.spacing(2)};
      margin-bottom: ${theme.spacing(2)};
    `,
    inputItemFirst: css`
      flex-basis: 40%;
    `,
    inputItem: css`
      flex-grow: 1;
      flex-basis: 20%;
      ${theme.breakpoints.down('md')} {
        min-width: 100%;
      }
    `,
    selectWrapper: css`
      margin-bottom: ${theme.spacing(1)};
    `,
    selectItem: css`
      display: flex;
      flex-direction: row;
      align-items: center;
    `,
    selectItemLabel: css`
      margin: 0 0 0 ${theme.spacing(1)};
      align-self: center;
      color: ${theme.colors.text.secondary};
    `,
    resultsHeading: css`
      margin: 0 0 0 0;
    `,
    resultsData: css`
      margin: 0 0 ${theme.spacing(1)} 0;
    `,
    resultsDataCount: css`
      margin: 0;
    `,
    resultsDataFiltered: css`
      margin: 0;
      color: ${theme.colors.warning.text};
    `,
    alphabetRow: css`
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      column-gap: ${theme.spacing(1)};
      margin-bottom: ${theme.spacing(1)};
    `,
    alphabetRowToggles: css`
      display: flex;
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      column-gap: ${theme.spacing(1)};
    `,
    results: css`
      height: calc(80vh - 280px);
      overflow-y: scroll;
    `,
    pageSettingsWrapper: css`
      padding-top: ${theme.spacing(1.5)};
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      position: sticky;
    `,
    pageSettings: css`
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    `,
    selAlpha: css`
      cursor: pointer;
      color: #6e9fff;
    `,
    active: css`
      cursor: pointer;
    `,
    gray: css`
      color: grey;
      opacity: 50%;
    `,
    loadingSpinner: css`
      display: inline-block;
      visibility: hidden;
    `,
    table: css`
      white-space: ${disableTextWrap ? 'nowrap' : 'normal'};
      td {
        vertical-align: baseline;
        padding: 0;
      }
    `,
    tableDiv: css`
      padding: 8px;
    `,
    visible: css`
      visibility: visible;
    `,
  };
};
