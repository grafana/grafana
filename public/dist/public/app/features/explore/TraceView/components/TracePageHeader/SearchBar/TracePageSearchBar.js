// Copyright (c) 2018 Uber Technologies, Inc.
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
import React, { memo, useMemo } from 'react';
import { Button, Switch, useStyles2 } from '@grafana/ui';
import { getButtonStyles } from '@grafana/ui/src/components/Button';
import { convertTimeFilter } from '../../utils/filter-spans';
import NextPrevResult from './NextPrevResult';
export default memo(function TracePageSearchBar(props) {
    const { trace, search, spanFilterMatches, showSpanFilterMatchesOnly, setShowSpanFilterMatchesOnly, focusedSpanIndexForSearch, setFocusedSpanIndexForSearch, setFocusedSpanIdForSearch, datasourceType, clear, showSpanFilters, } = props;
    const styles = useStyles2(getStyles);
    const clearEnabled = useMemo(() => {
        return ((search.serviceName && search.serviceName !== '') ||
            (search.spanName && search.spanName !== '') ||
            convertTimeFilter(search.from || '') ||
            convertTimeFilter(search.to || '') ||
            search.tags.length > 1 ||
            search.tags.some((tag) => {
                return tag.key;
            }) ||
            showSpanFilterMatchesOnly);
    }, [search.serviceName, search.spanName, search.from, search.to, search.tags, showSpanFilterMatchesOnly]);
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.controls },
            React.createElement(React.Fragment, null,
                React.createElement("div", { className: styles.clearButton },
                    React.createElement(Button, { variant: "destructive", disabled: !clearEnabled, type: "button", fill: "outline", "aria-label": "Clear filters button", onClick: clear }, "Clear"),
                    React.createElement("div", { className: styles.matchesOnly },
                        React.createElement(Switch, { value: showSpanFilterMatchesOnly, onChange: (value) => { var _a; return setShowSpanFilterMatchesOnly((_a = value.currentTarget.checked) !== null && _a !== void 0 ? _a : false); }, label: "Show matches only switch", disabled: !(spanFilterMatches === null || spanFilterMatches === void 0 ? void 0 : spanFilterMatches.size) }),
                        React.createElement(Button, { onClick: () => setShowSpanFilterMatchesOnly(!showSpanFilterMatchesOnly), className: styles.clearMatchesButton, variant: "secondary", fill: "text", disabled: !(spanFilterMatches === null || spanFilterMatches === void 0 ? void 0 : spanFilterMatches.size) }, "Show matches only"))),
                React.createElement("div", { className: styles.nextPrevResult },
                    React.createElement(NextPrevResult, { trace: trace, spanFilterMatches: spanFilterMatches, setFocusedSpanIdForSearch: setFocusedSpanIdForSearch, focusedSpanIndexForSearch: focusedSpanIndexForSearch, setFocusedSpanIndexForSearch: setFocusedSpanIndexForSearch, datasourceType: datasourceType, showSpanFilters: showSpanFilters }))))));
});
export const getStyles = (theme) => {
    const buttonStyles = getButtonStyles({ theme, variant: 'secondary', size: 'md', iconOnly: false, fill: 'outline' });
    return {
        button: css(buttonStyles.button),
        buttonDisabled: css(buttonStyles.disabled, { pointerEvents: 'none', cursor: 'not-allowed' }),
        container: css `
      display: inline;
    `,
        controls: css `
      display: flex;
      justify-content: flex-end;
      margin: 5px 0 0 0;
    `,
        clearButton: css `
      order: 1;
    `,
        matchesOnly: css `
      display: inline-flex;
      margin: 0 0 0 25px;
      vertical-align: middle;
      align-items: center;
    `,
        clearMatchesButton: css `
      color: ${theme.colors.text.primary};

      &:hover {
        background: inherit;
      }
    `,
        nextPrevResult: css `
      margin-left: auto;
      order: 2;
    `,
    };
};
//# sourceMappingURL=TracePageSearchBar.js.map