// Copyright (c) 2019 The Jaeger Authors.
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
import { css, cx } from '@emotion/css';
import * as React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
import { autoColor } from '../../Theme';
import { uAlignIcon, ubMb1 } from '../../uberUtilityStyles';
import ReferenceLink from '../../url/ReferenceLink';
import AccordianKeyValues from './AccordianKeyValues';
const getStyles = (theme) => {
    return {
        AccordianReferenceItem: css `
      border-bottom: 1px solid ${autoColor(theme, '#d8d8d8')};
    `,
        AccordianKeyValues: css `
      margin-left: 10px;
    `,
        AccordianReferences: css `
      label: AccordianReferences;
      border: 1px solid ${autoColor(theme, '#d8d8d8')};
      position: relative;
      margin-bottom: 0.25rem;
    `,
        AccordianReferencesHeader: css `
      label: AccordianReferencesHeader;
      background: ${autoColor(theme, '#e4e4e4')};
      color: inherit;
      display: block;
      padding: 0.25rem 0.5rem;
      &:hover {
        background: ${autoColor(theme, '#dadada')};
      }
    `,
        AccordianReferencesContent: css `
      label: AccordianReferencesContent;
      background: ${autoColor(theme, '#f0f0f0')};
      border-top: 1px solid ${autoColor(theme, '#d8d8d8')};
      padding: 0.5rem 0.5rem 0.25rem 0.5rem;
    `,
        AccordianReferencesFooter: css `
      label: AccordianReferencesFooter;
      color: ${autoColor(theme, '#999')};
    `,
        ReferencesList: css `
      background: #fff;
      border: 1px solid #ddd;
      margin-bottom: 0.7em;
      max-height: 450px;
      overflow: auto;
    `,
        list: css `
      width: 100%;
      list-style: none;
      padding: 0;
      margin: 0;
      background: #fff;
    `,
        itemContent: css `
      padding: 0.25rem 0.5rem;
      display: flex;
      width: 100%;
      justify-content: space-between;
    `,
        item: css `
      &:nth-child(2n) {
        background: #f5f5f5;
      }
    `,
        debugInfo: css `
      letter-spacing: 0.25px;
      margin: 0.5em 0 0;
      flex-wrap: wrap;
      display: flex;
      justify-content: flex-end;
    `,
        debugLabel: css `
      margin: 0 5px 0 5px;
      &::before {
        color: #bbb;
        content: attr(data-label);
      }
    `,
        serviceName: css `
      margin-right: 8px;
    `,
        title: css `
      display: flex;
      align-items: center;
      gap: 4px;
    `,
    };
};
// export for test
export function References(props) {
    const { data, createFocusSpanLink, openedItems, onItemToggle, interactive } = props;
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.AccordianReferencesContent }, data.map((reference, i) => {
        var _a;
        return (React.createElement("div", { className: i < data.length - 1 ? styles.AccordianReferenceItem : undefined, key: i },
            React.createElement("div", { className: styles.item, key: `${reference.spanID}` },
                React.createElement(ReferenceLink, { reference: reference, createFocusSpanLink: createFocusSpanLink },
                    React.createElement("span", { className: styles.itemContent },
                        reference.span ? (React.createElement("span", null,
                            React.createElement("span", { className: cx('span-svc-name', styles.serviceName) }, reference.span.process.serviceName),
                            React.createElement("small", { className: "endpoint-name" }, reference.span.operationName))) : (React.createElement("span", { className: cx('span-svc-name', styles.title) },
                            "View Linked Span ",
                            React.createElement(Icon, { name: "external-link-alt" }))),
                        React.createElement("small", { className: styles.debugInfo },
                            React.createElement("span", { className: styles.debugLabel, "data-label": "TraceID:" }, reference.traceID),
                            React.createElement("span", { className: styles.debugLabel, "data-label": "SpanID:" }, reference.spanID))))),
            !!((_a = reference.tags) === null || _a === void 0 ? void 0 : _a.length) && (React.createElement("div", { className: styles.AccordianKeyValues },
                React.createElement(AccordianKeyValues, { className: i < data.length - 1 ? ubMb1 : null, data: reference.tags || [], highContrast: true, interactive: interactive, isOpen: openedItems ? openedItems.has(reference) : false, label: 'attributes', linksGetter: null, onToggle: interactive && onItemToggle ? () => onItemToggle(reference) : null })))));
    })));
}
const AccordianReferences = ({ data, interactive = true, isOpen, onToggle, onItemToggle, openedItems, createFocusSpanLink, }) => {
    const isEmpty = !Array.isArray(data) || !data.length;
    let arrow = null;
    let HeaderComponent = 'span';
    let headerProps = null;
    if (interactive) {
        arrow = isOpen ? (React.createElement(Icon, { name: 'angle-down', className: uAlignIcon })) : (React.createElement(Icon, { name: 'angle-right', className: uAlignIcon }));
        HeaderComponent = 'a';
        headerProps = {
            'aria-checked': isOpen,
            onClick: isEmpty ? null : onToggle,
            role: 'switch',
        };
    }
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.AccordianReferences },
        React.createElement(HeaderComponent, Object.assign({ className: styles.AccordianReferencesHeader }, headerProps),
            arrow,
            React.createElement("strong", null,
                React.createElement("span", null, "References")),
            ' ',
            "(",
            data.length,
            ")"),
        isOpen && (React.createElement(References, { data: data, openedItems: openedItems, createFocusSpanLink: createFocusSpanLink, onItemToggle: onItemToggle, interactive: interactive }))));
};
export default React.memo(AccordianReferences);
//# sourceMappingURL=AccordianReferences.js.map