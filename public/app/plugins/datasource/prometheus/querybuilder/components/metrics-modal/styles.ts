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
      overflow-y: scroll;
      overflow-x: hidden;
    `,
    labelsTitle: css`
      font-weight: ${theme.typography.fontWeightBold};
      font-size: ${theme.typography.fontSize}px;
      padding: 5px 8px 5px 32px;
      border-bottom: 1px solid ${theme.colors.border.weak};
    `,

    metricsStickyHeader: css`
      border-bottom: 1px solid ${theme.colors.border.weak};
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      position: sticky;
      left: 0;
      z-index: 1;
      top: -24px;
      background: ${theme.colors.background.primary};
      @media only screen and (min-width: 768px) {
        top: 0;
      }
    `,

    labelsSearchWrapper: css`
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      position: sticky;
      left: 0;
      top: -24px;
      //@todo fix all the styles
      z-index: 3;
      @media only screen and (min-width: 768px) {
        top: 0;
      }
    `,
    wrapper: css`
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      flex-wrap: nowrap;
      @media only screen and (min-width: 768px) {
        display: grid;
        grid-template-columns: 33.334% 66.667%;
      }
    `,
    modalMetricsWrapper: css`
      width: 100%;
      @media only screen and (min-width: 768px) {
        padding-left: 16px;
      }
      @media only screen and (min-width: 1024px) {
        padding-left: 40px;
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
      width: 100%;
    `,
    exprPreviewTitle: css`
      color: ${theme.colors.text.secondary};
      margin-right: 8px;
    `,
    exprPreviewText: css`
      font-family: ${theme.typography.fontFamilyMonospace};
      color: ${theme.colors.text.primary};
    `,
    exprPreviewTextWrap: css`
      display: flex;
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
    tabletPlus: css`
      display: none;
      @media only screen and (min-width: 768px) {
        display: block;
      }
    `,
    mobileOnly: css`
      @media only screen and (min-width: 768px) {
        display: none;
      }
    `,
    stickyMobileFooter: css`
      position: sticky;
      bottom: 59px;
      left: 0;
      background: ${theme.colors.background.primary};
    `,

    footer: css`
      border-top: 1px solid ${theme.colors.border.weak};
      position: sticky;
      bottom: -24px;
      padding-bottom: 12px;
      left: 0;
      width: 100%;
      right: 0;
      display: flex;
      flex-direction: column;
      background: ${theme.colors.background.primary};
      z-index: 1;
    `,
    selectorValidMessage: css``,
    submitQueryButton: css`
      gap: 4px;
      align-self: flex-end;
    `,
    modalLabelsWrapper: css`
      width: 100%;
      height: auto;

      @media only screen and (min-width: 768px) {
        height: calc(80vh - 310px);
        overflow-y: scroll;
        padding-right: 16px;
        border-right: 1px solid ${theme.colors.border.weak};
      }
      @media only screen and (min-width: 1024px) {
        padding-right: 40px;
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
    labelInputItem: css`
      width: 100%;

      ${theme.breakpoints.down('md')} {
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
      @media only screen and (min-width: 768px) {
        height: calc(80vh - 410px);
      }
      @media only screen and (min-width: 1024px) {
        height: calc(80vh - 310px);
      }

      overflow-y: scroll;
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
    labelName: css``,
    labelNamesCollapsableSection: css`
      padding: 0;
    `,
  };
};
