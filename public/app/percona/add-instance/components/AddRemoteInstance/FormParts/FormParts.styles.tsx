import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ breakpoints, spacing, colors }: GrafanaTheme2) => ({
  groupWrapper: css`
    width: ${breakpoints.values.md}px;
  `,
  addServiceButton: css`
    margin-top: 30px;
  `,
  sectionHeader: css`
    margin-top: 15px;
    margin-bottom: 15px;
  `,
  // Temporary solution, will be removed after tooltip labels will be added to platform inputs
  labelWrapper: css`
    display: flex;
    font-weight: 500;
    color: rgb(159, 167, 179);
    svg {
      margin-left: ${spacing(1)};
    }
    margin-bottom: ${spacing(1)};
  `,
  urlFieldGroupWrapper: css`
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  `,
  urlFieldWrapper: css`
    width: 100%;
    margin-right: 5px;
  `,
  selectFieldWrapper: css`
    width: 100%;
  `,
  selectField: css`
    height: 38px;
  `,
  group: css`
    display: flex;
    flex-direction: row;
    gap: ${spacing(2)};

    ${breakpoints.down('md')} {
      flex-wrap: wrap;
    }

    & > * {
      width: 50%;
      margin-bottom: ${spacing(1)} !important;
    }
  `,
  radioField: css`
    label {
      /* match radio field height with inputs */
      margin-top: -3px;
      padding-bottom: 3px;
      padding-top: 3px;
      height: auto;
    }
  `,
  description: css`
    color: ${colors.text.secondary};
    font-weight: normal;
    margin-bottom: 0;
  `,
  additionalOptions: css`
    & > div:not(:last-child) {
      margin-bottom: -${spacing(2)} !important;
    }

    h4 {
      margin: ${spacing(2)} 0;
    }
  `,
  link: css`
    color: ${colors.text.link};
  `,
  extraDsnOptions: css`
    padding-top: ${spacing(1)};
  `,
});
