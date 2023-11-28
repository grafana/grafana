// Copyright (c) 2019 Uber Technologies, Inc.
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
import { uAlignIcon } from '../../uberUtilityStyles';
import { getStyles as getAccordianKeyValuesStyles } from './AccordianKeyValues';
import TextList from './TextList';
const getStyles = (theme) => {
    return {
        header: css `
      cursor: pointer;
      overflow: hidden;
      padding: 0.25em 0.1em;
      text-overflow: ellipsis;
      white-space: nowrap;
      &:hover {
        background: ${autoColor(theme, '#e8e8e8')};
      }
    `,
    };
};
function DefaultTextComponent({ data }) {
    return React.createElement(TextList, { data: data });
}
export default function AccordianText(props) {
    const { className, data, headerClassName, interactive, isOpen, label, onToggle, TextComponent = DefaultTextComponent, } = props;
    const isEmpty = !Array.isArray(data) || !data.length;
    const accordianKeyValuesStyles = useStyles2(getAccordianKeyValuesStyles);
    const iconCls = cx(uAlignIcon, { [accordianKeyValuesStyles.emptyIcon]: isEmpty });
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
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: className || '' },
        React.createElement("div", Object.assign({ className: cx(styles.header, headerClassName) }, headerProps, { "data-testid": "AccordianText--header" }),
            arrow,
            React.createElement("strong", null, label),
            " (",
            data.length,
            ")"),
        isOpen && React.createElement(TextComponent, { data: data })));
}
AccordianText.defaultProps = {
    className: null,
    highContrast: false,
    interactive: true,
    onToggle: null,
};
//# sourceMappingURL=AccordianText.js.map