import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    scheduleSectionWrapper: css `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${spacing.sm};
  `,
    firstSelectRow: css `
    padding-left: 30px;
  `,
    displayNone: css `
    display: none;
  `,
    multiSelectField: css `
    padding-bottom: ${spacing.md};
  `,
    multiselectRow: css `
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 10px;
    & > div {
      width: 100%;
    }
  `,
    selectLabel: css `
    display: flex;
    justify-content: center;
    align-items: center;
    height: 37px;
  `,
    selectField: css `
    padding-top: 7px;
    padding-bottom: 7px;
  `,
});
//# sourceMappingURL=ScheduleSectionFields.styles.js.map