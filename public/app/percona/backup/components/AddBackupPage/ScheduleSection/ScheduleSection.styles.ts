import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  scheduleSectionWrapper: css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${spacing.sm};
  `,
  SelectFieldWrap: css`
    display: flex;
    flex-direction: column;
    padding-top: ${spacing.xs};
    margin-bottom: 17px;
  `,
  selectField: css`
    padding-top: 7px;
    padding-bottom: 7px;
  `,
  displayNone: css`
    display: none;
  `,
  multiSelectField: css`
    padding-bottom: ${spacing.md};
  `,
  section: css`
    margin-top: 48px;
  `,
  retentionField: css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${spacing.sm};
  `,
  headingStyle: css`
    margin-bottom: ${spacing.lg};
  `,
  firstSelectRow: css`
    padding-left: 30px;
  `,
  selectRow: css`
    display: flex;
    align-items: flex-end;
    gap: 10px;
    & > span {
      margin-bottom: 16px;
    }
    & > div {
      width: 100%;
    }
  `,
  multiselectRow: css`
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 10px;
    & > div {
      width: 100%;
    }
  `,
  selectLabel: css`
    display: flex;
    justify-content: center;
    align-items: center;
    height: 37px;
  `,
});
