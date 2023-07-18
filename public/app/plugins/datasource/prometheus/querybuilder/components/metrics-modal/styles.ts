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
    labelsWrapper: css`
      display: flex;
      flex-direction: column;
      max-height: 80vh;
      overflow-y: scroll;
      overflow-x: hidden;
    `,
    labelsTitle: css`
      padding: 5px 8px 5px 32px;
      border-bottom: 1px solid var(${theme.colors.border.weak});
    `,
    inputWrapper: css`
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
    `,
    wrapper: css`
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      flex-wrap: nowrap;
      @media only screen and (min-width: 768px) {
        flex-direction: row;
      }
    `,
    modalMetricsWrapper: css`
      width: 100%;
      @media only screen and (min-width: 768px) {
      }
    `,
    exprButtons: css`
      display: flex;
      gap: 4px;
    `,
    exprPreview: css`
      display: flex;
      align-items: center;
      align-content: center;
      align-self: stretch;
    `,
    exprPreviewTitle: css`
      color: ${theme.colors.text.secondary};
      margin-right: 8px;
    `,
    exprPreviewText: css`
      font-family: ${theme.typography.fontFamilyMonospace};
      color: ${theme.colors.text.primary};
    `,
    exprPreviewWrap: css`
      display: flex;
      padding: 8px 12px;
      align-items: center;
      align-content: center;
      align-self: stretch;
      flex-wrap: nowrap;
      gap: 8px;

      // border-radius in theme?
      border-radius: 4px;
      border: 1px solid ${theme.colors.border.weak};
    `,
    selectorValidMessage: css``,
    submitQueryButton: css`
      gap: 4px;
    `,
    modalLabelsWrapper: css`
      width: 100%;
      @media only screen and (min-width: 768px) {
        max-width: 250px;
        width: 40%;
      }
    `,
    inputItemFirst: css`
      flex-basis: 40%;
      padding-right: 16px;

      ${theme.breakpoints.down('md')} {
        padding-right: 0px;
        padding-bottom: 16px;
      }
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
    resultsAmount: css`
      color: ${theme.colors.text.secondary};
      font-size: 0.85rem;
      padding: 0 0 4px 0;
    `,
    resultsData: css`
      margin: 4px 0 ${theme.spacing(2)} 0;
    `,
    resultsDataCount: css`
      margin: 0;
    `,
    resultsDataFiltered: css`
      color: ${theme.colors.text.secondary};
      text-align: center;
      border: solid 1px rgba(204, 204, 220, 0.25);
      padding: 7px;
    `,
    resultsDataFilteredText: css`
      display: inline;
      vertical-align: text-top;
    `,
    results: css`
      height: calc(80vh - 310px);
      overflow-y: scroll;
    `,
    resultsFooter: css`
      margin-top: 24px;
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      position: sticky;
    `,
    currentlySelected: css`
      color: grey;
      opacity: 75%;
      font-size: 0.75rem;
    `,
    loadingSpinner: css`
      visibility: hidden;
    `,
    visible: css`
      visibility: visible;
    `,
    settingsBtn: css`
      float: right;
    `,
    noBorder: css`
      border: none;
    `,
    resultsPerPageLabel: css`
      color: ${theme.colors.text.secondary};
      opacity: 75%;
      padding-top: 5px;
      font-size: 0.85rem;
      margin-right: 8px;
    `,
    resultsPerPageWrapper: css`
      display: flex;
    `,
    labelName: css``,
    labelNamesCollapsableSection: css`
      margin-bottom: 8px;
      padding: 0;
    `,
  };
};
