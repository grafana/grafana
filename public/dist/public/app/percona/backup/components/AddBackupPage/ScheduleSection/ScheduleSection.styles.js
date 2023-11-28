import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    SelectFieldWrap: css `
    display: flex;
    flex-direction: column;
    padding-top: ${spacing.xs};
    margin-bottom: 17px;
  `,
    selectField: css `
    padding-top: 7px;
    padding-bottom: 7px;
  `,
    section: css `
    margin-top: 48px;
  `,
    retentionField: css `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${spacing.sm};
  `,
    headingStyle: css `
    margin-bottom: ${spacing.lg};
  `,
    selectRow: css `
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
});
//# sourceMappingURL=ScheduleSection.styles.js.map