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
import { css } from '@emotion/css';
import cx from 'classnames';
import * as React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
import { autoColor } from '../../Theme';
import { uAlignIcon, uTxEllipsis } from '../../uberUtilityStyles';
import * as markers from './AccordianKeyValues.markers';
import KeyValuesTable from './KeyValuesTable';
export const getStyles = (theme) => {
    return {
        header: css `
      label: header;
      cursor: pointer;
      overflow: hidden;
      padding: 0.25em 0.1em;
      text-overflow: ellipsis;
      white-space: nowrap;
      &:hover {
        background: ${autoColor(theme, '#e8e8e8')};
      }
    `,
        headerEmpty: css `
      label: headerEmpty;
      background: none;
      cursor: initial;
    `,
        headerHighContrast: css `
      label: headerHighContrast;
      &:hover {
        background: ${autoColor(theme, '#ddd')};
      }
    `,
        emptyIcon: css `
      label: emptyIcon;
      color: ${autoColor(theme, '#aaa')};
    `,
        summary: css `
      label: summary;
      display: inline;
      list-style: none;
      padding: 0;
    `,
        summaryItem: css `
      label: summaryItem;
      display: inline;
      margin-left: 0.7em;
      padding-right: 0.5rem;
      border-right: 1px solid ${autoColor(theme, '#ddd')};
      &:last-child {
        padding-right: 0;
        border-right: none;
      }
    `,
        summaryLabel: css `
      label: summaryLabel;
      color: ${autoColor(theme, '#777')};
    `,
        summaryDelim: css `
      label: summaryDelim;
      color: ${autoColor(theme, '#bbb')};
      padding: 0 0.2em;
    `,
    };
};
// export for tests
export function KeyValuesSummary(props) {
    const { data } = props;
    const styles = useStyles2(getStyles);
    if (!Array.isArray(data) || !data.length) {
        return null;
    }
    return (React.createElement("ul", { className: styles.summary }, data.map((item, i) => (
    // `i` is necessary in the key because item.key can repeat
    React.createElement("li", { className: styles.summaryItem, key: `${item.key}-${i}` },
        React.createElement("span", { className: styles.summaryLabel }, item.key),
        React.createElement("span", { className: styles.summaryDelim }, "="),
        String(item.value))))));
}
KeyValuesSummary.defaultProps = {
    data: null,
};
export default function AccordianKeyValues(props) {
    const { className, data, highContrast, interactive, isOpen, label, linksGetter, onToggle } = props;
    const isEmpty = !Array.isArray(data) || !data.length;
    const styles = useStyles2(getStyles);
    const iconCls = cx(uAlignIcon, { [styles.emptyIcon]: isEmpty });
    let arrow = null;
    let headerProps = null;
    if (interactive) {
        arrow = isOpen ? (React.createElement(Icon, { name: 'angle-down', className: iconCls })) : (React.createElement(Icon, { name: 'angle-right', className: iconCls }));
        headerProps = {
            'aria-checked': isOpen,
            onClick: isEmpty ? null : onToggle,
            role: 'switch',
        };
    }
    return (React.createElement("div", { className: cx(className, uTxEllipsis) },
        React.createElement("div", Object.assign({ className: cx(styles.header, {
                [styles.headerEmpty]: isEmpty,
                [styles.headerHighContrast]: highContrast && !isEmpty,
            }) }, headerProps, { "data-testid": "AccordianKeyValues--header" }),
            arrow,
            React.createElement("strong", { "data-test": markers.LABEL },
                label,
                isOpen || ':'),
            !isOpen && React.createElement(KeyValuesSummary, { data: data })),
        isOpen && React.createElement(KeyValuesTable, { data: data, linksGetter: linksGetter })));
}
AccordianKeyValues.defaultProps = {
    className: null,
    highContrast: false,
    interactive: true,
    onToggle: null,
};
//# sourceMappingURL=AccordianKeyValues.js.map