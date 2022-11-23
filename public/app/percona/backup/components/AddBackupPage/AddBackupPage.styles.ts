import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ breakpoints, colors, shape, spacing, v1: { spacing: spacingV1 } }: GrafanaTheme2) => ({
  pageWrapper: css`
    max-width: ${breakpoints.values.xxl}px;
  `,
  formContainer: css`
    display: grid;
    justify-content: center;
    align-items: center;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: ${spacingV1.sm};
  `,
  advanceSection: css`
    width: 100%;
    display: grid;
    gap: ${spacingV1.sm};
    grid-template-columns: 1fr 1fr;
  `,
  collapsableSection: css`
    grid-row-start: 2;
  `,
  wideField: css`
    grid-column: span 2;
  `,
  SelectFieldWrap: css`
    display: flex;
    flex-direction: column;
    padding-top: ${spacingV1.xs};
    margin-bottom: 17px;
  `,
  selectField: css`
    padding-top: 7px;
    padding-bottom: 7px;
  `,
  radioButtonField: css`
    & > div > div:nth-of-type(2) * {
      height: 37px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  `,
  backupTypeField: css`
    grid-row-start: 4;
  `,
  textAreaField: css`
    & > textarea {
      height: 50px;
    }
  `,
  contentInner: css`
    flex: 1;
    padding: ${spacing(2)};
  `,
  contentOuter: css`
    background: ${colors.background.primary};
    border: 1px solid ${colors.border.weak};
    border-radius: ${shape.borderRadius()};
    margin: ${spacing(0, 2, 2)};
    overflow: hidden;
    flex: 1;
  `,
  form: css`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  `,
  headingStyle: css`
    margin-bottom: ${spacingV1.lg};
  `,
  pageSwitcher: css`
    margin-bottom: ${spacingV1.lg};
  `,
});
