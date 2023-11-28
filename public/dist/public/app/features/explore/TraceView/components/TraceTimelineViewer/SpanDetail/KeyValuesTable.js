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
import CopyIcon from '../../common/CopyIcon';
import { ubInlineBlock, uWidth100 } from '../../uberUtilityStyles';
import jsonMarkup from './jsonMarkup';
const copyIconClassName = 'copyIcon';
export const getStyles = (theme) => {
    return {
        KeyValueTable: css `
      label: KeyValueTable;
      background: ${autoColor(theme, '#fff')};
      border: 1px solid ${autoColor(theme, '#ddd')};
      margin-bottom: 0.5rem;
      max-height: 450px;
      overflow: auto;
    `,
        body: css `
      label: body;
      vertical-align: baseline;
    `,
        row: css `
      label: row;
      & > td {
        padding: 0rem 0.5rem;
        height: 30px;
      }
      &:nth-child(2n) > td {
        background: ${autoColor(theme, '#f5f5f5')};
      }
      &:not(:hover) .${copyIconClassName} {
        visibility: hidden;
      }
    `,
        keyColumn: css `
      label: keyColumn;
      color: ${autoColor(theme, '#888')};
      white-space: pre;
      width: 125px;
    `,
        copyColumn: css `
      label: copyColumn;
      text-align: right;
    `,
        linkIcon: css `
      label: linkIcon;
      vertical-align: middle;
      font-weight: bold;
    `,
    };
};
const jsonObjectOrArrayStartRegex = /^(\[|\{)/;
function parseIfComplexJson(value) {
    // if the value is a string representing actual json object or array, then use json-markup
    if (typeof value === 'string' && jsonObjectOrArrayStartRegex.test(value)) {
        // otherwise just return as is
        try {
            return JSON.parse(value);
            // eslint-disable-next-line no-empty
        }
        catch (_) { }
    }
    return value;
}
export const LinkValue = (props) => {
    return (React.createElement("a", { href: props.href, title: props.title, target: "_blank", rel: "noopener noreferrer" },
        props.children,
        " ",
        React.createElement(Icon, { name: "external-link-alt" })));
};
LinkValue.defaultProps = {
    title: '',
};
export default function KeyValuesTable(props) {
    const { data, linksGetter } = props;
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: cx(styles.KeyValueTable), "data-testid": "KeyValueTable" },
        React.createElement("table", { className: uWidth100 },
            React.createElement("tbody", { className: styles.body }, data.map((row, i) => {
                const markup = {
                    __html: jsonMarkup(parseIfComplexJson(row.value)),
                };
                const jsonTable = React.createElement("div", { className: ubInlineBlock, dangerouslySetInnerHTML: markup });
                const links = linksGetter ? linksGetter(data, i) : null;
                let valueMarkup;
                if (links && links.length) {
                    // TODO: handle multiple items
                    valueMarkup = (React.createElement("div", null,
                        React.createElement(LinkValue, { href: links[0].url, title: links[0].text }, jsonTable)));
                }
                else {
                    valueMarkup = jsonTable;
                }
                return (
                // `i` is necessary in the key because row.key can repeat
                React.createElement("tr", { className: styles.row, key: `${row.key}-${i}` },
                    React.createElement("td", { className: styles.keyColumn, "data-testid": "KeyValueTable--keyColumn" }, row.key),
                    React.createElement("td", null, valueMarkup),
                    React.createElement("td", { className: styles.copyColumn },
                        React.createElement(CopyIcon, { className: copyIconClassName, copyText: JSON.stringify(row, null, 2), tooltipTitle: "Copy JSON" }))));
            })))));
}
//# sourceMappingURL=KeyValuesTable.js.map