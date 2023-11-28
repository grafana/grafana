// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { css, keyframes } from '@emotion/css';
import cx from 'classnames';
import * as React from 'react';
import { Icon, stylesFactory, withTheme2 } from '@grafana/ui';
import { autoColor } from '../Theme';
import { DURATION, NONE, TAG } from '../settings/SpanBarSettings';
import SpanBar from './SpanBar';
import { SpanLinksMenu } from './SpanLinks';
import SpanTreeOffset from './SpanTreeOffset';
import Ticks from './Ticks';
import TimelineRow from './TimelineRow';
import { formatDuration } from './utils';
const spanBarClassName = 'spanBar';
const spanBarLabelClassName = 'spanBarLabel';
const nameWrapperClassName = 'nameWrapper';
const nameWrapperMatchingFilterClassName = 'nameWrapperMatchingFilter';
const viewClassName = 'jaegerView';
const nameColumnClassName = 'nameColumn';
const getStyles = stylesFactory((theme, showSpanFilterMatchesOnly) => {
    const animations = {
        label: 'flash',
        flash: keyframes `
    from {
      background-color: ${autoColor(theme, '#68b9ff')};
    }
    to {
      background-color: 'default';
    }
  `,
    };
    const backgroundColor = showSpanFilterMatchesOnly ? '' : autoColor(theme, '#fffce4');
    return {
        nameWrapper: css `
      label: nameWrapper;
      line-height: 27px;
      overflow: hidden;
      display: flex;
    `,
        nameWrapperMatchingFilter: css `
      label: nameWrapperMatchingFilter;
      background-color: ${backgroundColor};
    `,
        nameColumn: css `
      label: nameColumn;
      position: relative;
      white-space: nowrap;
      z-index: 1;
      &:hover {
        z-index: 1;
      }
    `,
        endpointName: css `
      label: endpointName;
      color: ${autoColor(theme, '#484848')};
      font-size: 0.9em;
    `,
        view: css `
      label: view;
      position: relative;
    `,
        viewExpanded: css `
      label: viewExpanded;
      background: ${autoColor(theme, '#f8f8f8')};
      outline: 1px solid ${autoColor(theme, '#ddd')};
    `,
        viewExpandedAndMatchingFilter: css `
      label: viewExpandedAndMatchingFilter;
      background: ${autoColor(theme, '#fff3d7')};
      outline: 1px solid ${autoColor(theme, '#ddd')};
    `,
        row: css `
      label: row;
      font-size: 0.9em;
      &:hover .${spanBarClassName} {
        opacity: 1;
      }
      &:hover .${spanBarLabelClassName} {
        color: ${autoColor(theme, '#000')};
      }
      &:hover .${nameWrapperClassName} {
        background: #f8f8f8;
        background: linear-gradient(
          90deg,
          ${autoColor(theme, '#fafafa')},
          ${autoColor(theme, '#f8f8f8')} 75%,
          ${autoColor(theme, '#eee')}
        );
      }
      &:hover .${viewClassName} {
        background-color: ${autoColor(theme, '#f5f5f5')};
        outline: 1px solid ${autoColor(theme, '#ddd')};
      }
    `,
        rowClippingLeft: css `
      label: rowClippingLeft;
      & .${nameColumnClassName}::before {
        content: ' ';
        height: 100%;
        position: absolute;
        width: 6px;
        background-image: linear-gradient(
          to right,
          ${autoColor(theme, 'rgba(25, 25, 25, 0.25)')},
          ${autoColor(theme, 'rgba(32, 32, 32, 0)')}
        );
        left: 100%;
        z-index: -1;
      }
    `,
        rowClippingRight: css `
      label: rowClippingRight;
      & .${viewClassName}::before {
        content: ' ';
        height: 100%;
        position: absolute;
        width: 6px;
        background-image: linear-gradient(
          to left,
          ${autoColor(theme, 'rgba(25, 25, 25, 0.25)')},
          ${autoColor(theme, 'rgba(25, 25, 25, 0.25)')}
        );
        right: 0%;
        z-index: 1;
      }
    `,
        rowExpanded: css `
      label: rowExpanded;
      & .${spanBarClassName} {
        opacity: 1;
      }
      & .${spanBarLabelClassName} {
        color: ${autoColor(theme, '#000')};
      }
      & .${nameWrapperClassName}, &:hover .${nameWrapperClassName} {
        background: ${autoColor(theme, '#f0f0f0')};
        box-shadow: 0 1px 0 ${autoColor(theme, '#ddd')};
      }
      & .${nameWrapperMatchingFilterClassName} {
        background: ${autoColor(theme, '#fff3d7')};
      }
      &:hover .${viewClassName} {
        background: ${autoColor(theme, '#eee')};
      }
    `,
        rowMatchingFilter: css `
      label: rowMatchingFilter;
      // background-color: ${autoColor(theme, '#fffbde')};
      &:hover .${nameWrapperClassName} {
        background: linear-gradient(
          90deg,
          ${autoColor(theme, '#fffbde')},
          ${autoColor(theme, '#fffbde')} 75%,
          ${autoColor(theme, '#f7f1c6')}
        );
      }
      &:hover .${viewClassName} {
        background-color: ${autoColor(theme, '#f7f1c6')};
        outline: 1px solid ${autoColor(theme, '#ddd')};
      }
    `,
        rowFocused: css `
      label: rowFocused;
      background-color: ${autoColor(theme, '#cbe7ff')};
      animation: ${animations.flash} 1s cubic-bezier(0.12, 0, 0.39, 0);
      & .${nameWrapperClassName}, .${viewClassName}, .${nameWrapperMatchingFilterClassName} {
        background-color: ${autoColor(theme, '#cbe7ff')};
        animation: ${animations.flash} 1s cubic-bezier(0.12, 0, 0.39, 0);
      }
      & .${spanBarClassName} {
        opacity: 1;
      }
      & .${spanBarLabelClassName} {
        color: ${autoColor(theme, '#000')};
      }
      &:hover .${nameWrapperClassName}, :hover .${viewClassName} {
        background: ${autoColor(theme, '#d5ebff')};
        box-shadow: 0 1px 0 ${autoColor(theme, '#ddd')};
      }
    `,
        rowExpandedAndMatchingFilter: css `
      label: rowExpandedAndMatchingFilter;
      &:hover .${viewClassName} {
        background: ${autoColor(theme, '#ffeccf')};
      }
    `,
        name: css `
      label: name;
      color: ${autoColor(theme, '#000')};
      cursor: pointer;
      flex: 1 1 auto;
      outline: none;
      overflow-y: hidden;
      overflow-x: auto;
      padding-left: 4px;
      padding-right: 0.25em;
      position: relative;
      -ms-overflow-style: none;
      scrollbar-width: none;
      &::-webkit-scrollbar {
        display: none;
      }
      &:focus {
        text-decoration: none;
      }
      &:hover > span {
        color: ${autoColor(theme, '#000')};
      }
      text-align: left;
      background: transparent;
      border: none;
      border-bottom-width: 1px;
      border-bottom-style: solid;
    `,
        nameDetailExpanded: css `
      label: nameDetailExpanded;
      &::before {
        bottom: 0;
      }
    `,
        svcName: css `
      label: svcName;
      font-size: 0.9em;
      font-weight: bold;
      margin-right: 0.25rem;
    `,
        svcNameChildrenCollapsed: css `
      label: svcNameChildrenCollapsed;
      font-weight: bold;
      font-style: italic;
    `,
        errorIcon: css `
      label: errorIcon;
      border-radius: 6.5px;
      color: ${autoColor(theme, '#fff')};
      font-size: 0.85em;
      margin-right: 0.25rem;
      padding: 1px;
    `,
        rpcColorMarker: css `
      label: rpcColorMarker;
      border-radius: 6.5px;
      display: inline-block;
      font-size: 0.85em;
      height: 1em;
      margin-right: 0.25rem;
      padding: 1px;
      width: 1em;
      vertical-align: middle;
    `,
        labelRight: css `
      label: labelRight;
      left: 100%;
    `,
        labelLeft: css `
      label: labelLeft;
      right: 100%;
    `,
    };
});
/**
 * This was originally a stateless function, but changing to a PureComponent
 * reduced the render time of expanding a span row detail by ~50%. This is
 * even true in the case where the stateless function has the same prop types as
 * this class and arrow functions are created in the stateless function as
 * handlers to the onClick props. E.g. for now, the PureComponent is more
 * performance than the stateless function.
 */
export class UnthemedSpanBarRow extends React.PureComponent {
    constructor() {
        super(...arguments);
        this._detailToggle = () => {
            this.props.onDetailToggled(this.props.span.spanID);
        };
        this._childrenToggle = () => {
            this.props.onChildrenToggled(this.props.span.spanID);
        };
        this.getSpanBarLabel = (span, spanBarOptions, duration) => {
            var _a, _b, _c, _d, _e, _f;
            const type = (_a = spanBarOptions === null || spanBarOptions === void 0 ? void 0 : spanBarOptions.type) !== null && _a !== void 0 ? _a : '';
            if (type === NONE) {
                return '';
            }
            else if (type === '' || type === DURATION) {
                return `(${duration})`;
            }
            else if (type === TAG) {
                const tagKey = (_c = (_b = spanBarOptions === null || spanBarOptions === void 0 ? void 0 : spanBarOptions.tag) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : '';
                if (tagKey !== '' && span.tags) {
                    const tag = (_d = span.tags) === null || _d === void 0 ? void 0 : _d.find((tag) => {
                        return tag.key === tagKey;
                    });
                    if (tag) {
                        return `(${tag.value})`;
                    }
                    const process = (_f = (_e = span.process) === null || _e === void 0 ? void 0 : _e.tags) === null || _f === void 0 ? void 0 : _f.find((process) => {
                        return process.key === tagKey;
                    });
                    if (process) {
                        return `(${process.value})`;
                    }
                }
            }
            return '';
        };
    }
    render() {
        const { className, color, spanBarOptions, columnDivision, isChildrenExpanded, isDetailExpanded, isMatchingFilter, showSpanFilterMatchesOnly, isFocused, numTicks, rpc, noInstrumentedServer, showErrorIcon, getViewedBounds, traceStartTime, span, hoverIndentGuideIds, addHoverIndentGuideId, removeHoverIndentGuideId, clippingLeft, clippingRight, theme, createSpanLink, datasourceType, showServiceName, visibleSpanIds, } = this.props;
        const { duration, hasChildren: isParent, operationName, process: { serviceName }, } = span;
        const label = formatDuration(duration);
        const viewBounds = getViewedBounds(span.startTime, span.startTime + span.duration);
        const viewStart = viewBounds.start;
        const viewEnd = viewBounds.end;
        const styles = getStyles(theme, showSpanFilterMatchesOnly);
        const labelDetail = `${serviceName}::${operationName}`;
        let longLabel;
        let hintClassName;
        if (viewStart > 1 - viewEnd) {
            longLabel = `${labelDetail} | ${label}`;
            hintClassName = styles.labelLeft;
        }
        else {
            longLabel = `${label} | ${labelDetail}`;
            hintClassName = styles.labelRight;
        }
        return (React.createElement(TimelineRow, { className: cx(styles.row, {
                [styles.rowExpanded]: isDetailExpanded,
                [styles.rowMatchingFilter]: isMatchingFilter,
                [styles.rowExpandedAndMatchingFilter]: isMatchingFilter && isDetailExpanded,
                [styles.rowFocused]: isFocused,
                [styles.rowClippingLeft]: clippingLeft,
                [styles.rowClippingRight]: clippingRight,
            }, className) },
            React.createElement(TimelineRow.Cell, { className: cx(styles.nameColumn, nameColumnClassName), width: columnDivision },
                React.createElement("div", { className: cx(styles.nameWrapper, nameWrapperClassName, {
                        [styles.nameWrapperMatchingFilter]: isMatchingFilter,
                        nameWrapperMatchingFilter: isMatchingFilter,
                    }) },
                    React.createElement(SpanTreeOffset, { onClick: isParent ? this._childrenToggle : undefined, childrenVisible: isChildrenExpanded, span: span, hoverIndentGuideIds: hoverIndentGuideIds, addHoverIndentGuideId: addHoverIndentGuideId, removeHoverIndentGuideId: removeHoverIndentGuideId, visibleSpanIds: visibleSpanIds }),
                    React.createElement("button", { type: "button", className: cx(styles.name, { [styles.nameDetailExpanded]: isDetailExpanded }), "aria-checked": isDetailExpanded, title: labelDetail, onClick: this._detailToggle, role: "switch", style: { background: `${color}10`, borderBottomColor: `${color}CF` }, tabIndex: 0 },
                        showErrorIcon && (React.createElement(Icon, { name: 'exclamation-circle', style: {
                                backgroundColor: span.errorIconColor
                                    ? autoColor(theme, span.errorIconColor)
                                    : autoColor(theme, '#db2828'),
                            }, className: styles.errorIcon })),
                        showServiceName && (React.createElement("span", { className: cx(styles.svcName, {
                                [styles.svcNameChildrenCollapsed]: isParent && !isChildrenExpanded,
                            }) }, `${serviceName} `)),
                        rpc && (React.createElement("span", null,
                            React.createElement(Icon, { name: 'arrow-right' }),
                            ' ',
                            React.createElement("i", { className: styles.rpcColorMarker, style: { background: rpc.color } }),
                            rpc.serviceName)),
                        noInstrumentedServer && (React.createElement("span", null,
                            React.createElement(Icon, { name: 'arrow-right' }),
                            ' ',
                            React.createElement("i", { className: styles.rpcColorMarker, style: { background: noInstrumentedServer.color } }),
                            noInstrumentedServer.serviceName)),
                        React.createElement("span", { className: styles.endpointName }, rpc ? rpc.operationName : operationName),
                        React.createElement("span", { className: styles.endpointName },
                            " ",
                            this.getSpanBarLabel(span, spanBarOptions, label))),
                    createSpanLink &&
                        (() => {
                            const links = createSpanLink(span);
                            const count = (links === null || links === void 0 ? void 0 : links.length) || 0;
                            if (links && count === 1) {
                                if (!links[0]) {
                                    return null;
                                }
                                return (React.createElement("a", { href: links[0].href, 
                                    // Needs to have target otherwise preventDefault would not work due to angularRouter.
                                    target: '_blank', style: { background: `${color}10`, borderBottom: `1px solid ${color}CF`, paddingRight: '4px' }, rel: "noopener noreferrer", onClick: links[0].onClick
                                        ? (event) => {
                                            if (!(event.ctrlKey || event.metaKey || event.shiftKey) && links[0].onClick) {
                                                event.preventDefault();
                                                links[0].onClick(event);
                                            }
                                        }
                                        : undefined }, links[0].content));
                            }
                            else if (links && count > 1) {
                                return React.createElement(SpanLinksMenu, { links: links, datasourceType: datasourceType, color: color });
                            }
                            else {
                                return null;
                            }
                        })())),
            React.createElement(TimelineRow.Cell, { className: cx(styles.view, viewClassName, {
                    [styles.viewExpanded]: isDetailExpanded,
                    [styles.viewExpandedAndMatchingFilter]: isMatchingFilter && isDetailExpanded,
                }), "data-testid": "span-view", style: { cursor: 'pointer' }, width: 1 - columnDivision, onClick: this._detailToggle },
                React.createElement(Ticks, { numTicks: numTicks }),
                React.createElement(SpanBar, { rpc: rpc, viewStart: viewStart, viewEnd: viewEnd, getViewedBounds: getViewedBounds, color: color, shortLabel: label, longLabel: longLabel, traceStartTime: traceStartTime, span: span, labelClassName: `${spanBarLabelClassName} ${hintClassName}`, className: spanBarClassName }))));
    }
}
UnthemedSpanBarRow.displayName = 'UnthemedSpanBarRow';
UnthemedSpanBarRow.defaultProps = {
    className: '',
    rpc: null,
};
export default withTheme2(UnthemedSpanBarRow);
//# sourceMappingURL=SpanBarRow.js.map