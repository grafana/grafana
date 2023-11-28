import { css } from '@emotion/css';
export const styles = {
    optionWrapper: css `
    align-items: center;
    display: flex;
    justify-content: space-between;
  `,
    optionText: css `
    display: flex;
    flex-direction: column;
    max-width: 75%;
    white-space: normal;
  `,
    optionTitle: css `
    color: #d8d9da;
    white-space: nowrap;
  `,
    optionDescription: css `
    color: #8e8e8e;
    font-size: 10px;
    line-height: 1.5em;
  `,
    tagWrapper: css `
    margin-left: 4px;
  `,
    tag: css `
    background-color: #646464;
    border: 1px solid #8a8a8a;
    border-radius: 3px;
    color: #f2f2f2;
    font-size: 11px;
    margin-left: 6px;
    padding: 2px 4px;
  `,
    notAvailableTag: css `
    background-color: #646464;
    border: 1px solid #8a8a8a;
    border-radius: 3px;
    color: gray;
    font-size: 11px;
    margin-left: 6px;
    padding: 2px 4px;
  `,
};
//# sourceMappingURL=OptionContent.styles.js.map