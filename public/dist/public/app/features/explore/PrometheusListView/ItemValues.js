import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui/';
import { RawPrometheusListItemEmptyValue } from '../utils/getRawPrometheusListItemsFromDataFrame';
import { rawListItemColumnWidth, rawListPaddingToHoldSpaceForCopyIcon } from './RawListItem';
const getStyles = (theme, totalNumberOfValues) => ({
    rowWrapper: css `
    position: relative;
    min-width: ${rawListItemColumnWidth};
    padding-right: 5px;
  `,
    rowValue: css `
    white-space: nowrap;
    overflow-x: auto;
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
    display: block;
    padding-right: 10px;

    &::-webkit-scrollbar {
      display: none; /* Chrome, Safari and Opera */
    }

    &:before {
      pointer-events: none;
      content: '';
      width: 100%;
      height: 100%;
      position: absolute;
      left: 0;
      top: 0;
      background: linear-gradient(to right, transparent calc(100% - 25px), ${theme.colors.background.primary});
    }
  `,
    rowValuesWrap: css `
    padding-left: ${rawListPaddingToHoldSpaceForCopyIcon};
    width: calc(${totalNumberOfValues} * ${rawListItemColumnWidth});
    display: flex;
  `,
});
export const ItemValues = ({ totalNumberOfValues, values, hideFieldsWithoutValues, }) => {
    const styles = useStyles2(getStyles, totalNumberOfValues);
    return (React.createElement("div", { role: 'cell', className: styles.rowValuesWrap }, values === null || values === void 0 ? void 0 : values.map((value) => {
        if (hideFieldsWithoutValues && (value.value === undefined || value.value === RawPrometheusListItemEmptyValue)) {
            return null;
        }
        return (React.createElement("span", { key: value.key, className: styles.rowWrapper },
            React.createElement("span", { className: styles.rowValue }, value.value)));
    })));
};
//# sourceMappingURL=ItemValues.js.map