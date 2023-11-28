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
import { sortBy as _sortBy } from 'lodash';
import * as React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
import { autoColor } from '../../Theme';
import { uAlignIcon, ubMb1 } from '../../uberUtilityStyles';
import { formatDuration } from '../utils';
import AccordianKeyValues from './AccordianKeyValues';
const getStyles = (theme) => {
    return {
        AccordianLogs: css `
      label: AccordianLogs;
      border: 1px solid ${autoColor(theme, '#d8d8d8')};
      position: relative;
      margin-bottom: 0.25rem;
    `,
        AccordianLogsHeader: css `
      label: AccordianLogsHeader;
      background: ${autoColor(theme, '#e4e4e4')};
      color: inherit;
      display: block;
      padding: 0.25rem 0.5rem;
      &:hover {
        background: ${autoColor(theme, '#dadada')};
      }
    `,
        AccordianLogsContent: css `
      label: AccordianLogsContent;
      background: ${autoColor(theme, '#f0f0f0')};
      border-top: 1px solid ${autoColor(theme, '#d8d8d8')};
      padding: 0.5rem 0.5rem 0.25rem 0.5rem;
    `,
        AccordianLogsFooter: css `
      label: AccordianLogsFooter;
      color: ${autoColor(theme, '#999')};
    `,
    };
};
export default function AccordianLogs(props) {
    const { interactive, isOpen, linksGetter, logs, openedItems, onItemToggle, onToggle, timestamp } = props;
    let arrow = null;
    let HeaderComponent = 'span';
    let headerProps = null;
    if (interactive) {
        arrow = isOpen ? (React.createElement(Icon, { name: 'angle-down', className: uAlignIcon })) : (React.createElement(Icon, { name: 'angle-right', className: "u-align-icon" }));
        HeaderComponent = 'a';
        headerProps = {
            'aria-checked': isOpen,
            onClick: onToggle,
            role: 'switch',
        };
    }
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.AccordianLogs },
        React.createElement(HeaderComponent, Object.assign({ className: styles.AccordianLogsHeader }, headerProps),
            arrow,
            " ",
            React.createElement("strong", null, "Events"),
            " (",
            logs.length,
            ")"),
        isOpen && (React.createElement("div", { className: styles.AccordianLogsContent },
            _sortBy(logs, 'timestamp').map((log, i) => (React.createElement(AccordianKeyValues
            // `i` is necessary in the key because timestamps can repeat
            , { 
                // `i` is necessary in the key because timestamps can repeat
                key: `${log.timestamp}-${i}`, className: i < logs.length - 1 ? ubMb1 : null, data: log.fields || [], highContrast: true, interactive: interactive, isOpen: openedItems ? openedItems.has(log) : false, label: `${formatDuration(log.timestamp - timestamp)}`, linksGetter: linksGetter, onToggle: interactive && onItemToggle ? () => onItemToggle(log) : null }))),
            React.createElement("small", { className: styles.AccordianLogsFooter }, "Log timestamps are relative to the start time of the full trace.")))));
}
AccordianLogs.defaultProps = {
    interactive: true,
    linksGetter: undefined,
    onItemToggle: undefined,
    onToggle: undefined,
    openedItems: undefined,
};
//# sourceMappingURL=AccordianLogs.js.map