import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React, { useEffect, useId, useRef, useState } from 'react';
import { useWindowSize } from 'react-use';
import { VariableSizeList as List } from 'react-window';
import { reportInteraction } from '@grafana/runtime/src';
import { Field, Switch } from '@grafana/ui/';
import { getRawPrometheusListItemsFromDataFrame, RawPrometheusListItemEmptyValue, } from '../utils/getRawPrometheusListItemsFromDataFrame';
import { ItemLabels } from './ItemLabels';
import RawListItem from './RawListItem';
const styles = {
    wrapper: css `
    height: 100%;
    overflow: scroll;
  `,
    switchWrapper: css `
    display: flex;
    flex-direction: row;
    margin-bottom: 0;
  `,
    switchLabel: css `
    margin-left: 15px;
    margin-bottom: 0;
  `,
    switch: css `
    margin-left: 10px;
  `,
    resultCount: css `
    margin-bottom: 4px;
  `,
    header: css `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    font-size: 12px;
    line-height: 1.25;
  `,
};
const mobileWidthThreshold = 480;
const numberOfColumnsBeforeExpandedViewIsDefault = 2;
/**
 * The container that provides the virtualized list to the child components
 * @param props
 * @constructor
 */
const RawListContainer = (props) => {
    const { tableResult } = props;
    const dataFrame = cloneDeep(tableResult);
    const listRef = useRef(null);
    const valueLabels = dataFrame.fields.filter((field) => field.name.includes('Value'));
    const items = getRawPrometheusListItemsFromDataFrame(dataFrame);
    const { width } = useWindowSize();
    const [isExpandedView, setIsExpandedView] = useState(width <= mobileWidthThreshold || valueLabels.length > numberOfColumnsBeforeExpandedViewIsDefault);
    const onContentClick = () => {
        setIsExpandedView(!isExpandedView);
        const props = {
            isExpanded: !isExpandedView,
        };
        reportInteraction('grafana_explore_prometheus_instant_query_ui_raw_toggle_expand', props);
    };
    useEffect(() => {
        var _a;
        // After the expanded view has updated, tell the list to re-render
        (_a = listRef.current) === null || _a === void 0 ? void 0 : _a.resetAfterIndex(0, true);
    }, [isExpandedView]);
    const calculateInitialHeight = (length) => {
        const maxListHeight = 600;
        const shortListLength = 10;
        if (length < shortListLength) {
            let sum = 0;
            for (let i = 0; i < length; i++) {
                sum += getListItemHeight(i, true);
            }
            return Math.min(maxListHeight, sum);
        }
        return maxListHeight;
    };
    const getListItemHeight = (itemIndex, isExpandedView) => {
        const singleLineHeight = 32;
        const additionalLineHeight = 22;
        if (!isExpandedView) {
            return singleLineHeight;
        }
        const item = items[itemIndex];
        // Height of 1.5 lines, plus the number of non-value attributes times the height of additional lines
        return 1.5 * singleLineHeight + (Object.keys(item).length - valueLabels.length) * additionalLineHeight;
    };
    const switchId = `isExpandedView ${useId()}`;
    return (React.createElement("section", null,
        React.createElement("header", { className: styles.header },
            React.createElement(Field, { className: styles.switchWrapper, label: `Expand results`, htmlFor: 'isExpandedView' },
                React.createElement("div", { className: styles.switch },
                    React.createElement(Switch, { onChange: onContentClick, id: switchId, value: isExpandedView, label: `Expand results` }))),
            React.createElement("div", { className: styles.resultCount },
                "Result series: ",
                items.length)),
        React.createElement("div", { role: 'table' }, React.createElement(React.Fragment, null,
            valueLabels.length > 1 && !isExpandedView && (React.createElement(ItemLabels, { valueLabels: valueLabels, expanded: isExpandedView })),
            React.createElement(List, { ref: listRef, itemCount: items.length, className: styles.wrapper, itemSize: (index) => getListItemHeight(index, isExpandedView), height: calculateInitialHeight(items.length), width: "100%" }, ({ index, style }) => {
                let filteredValueLabels;
                if (isExpandedView) {
                    filteredValueLabels = valueLabels.filter((valueLabel) => {
                        const itemWithValue = items[index][valueLabel.name];
                        return itemWithValue && itemWithValue !== RawPrometheusListItemEmptyValue;
                    });
                }
                return (React.createElement("div", { role: "row", style: Object.assign(Object.assign({}, style), { overflow: 'hidden' }) },
                    React.createElement(RawListItem, { isExpandedView: isExpandedView, valueLabels: filteredValueLabels, totalNumberOfValues: valueLabels.length, listKey: items[index].__name__, listItemData: items[index] })));
            })))));
};
export default RawListContainer;
//# sourceMappingURL=RawListContainer.js.map