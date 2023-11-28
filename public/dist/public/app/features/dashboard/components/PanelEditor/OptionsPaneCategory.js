import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useLocalStorage } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Counter, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { PANEL_EDITOR_UI_STATE_STORAGE_KEY } from './state/reducers';
const CATEGORY_PARAM_NAME = 'showCategory';
export const OptionsPaneCategory = React.memo(({ id, title, children, forceOpen, isOpenDefault, renderTitle, className, itemsCount, isNested = false, sandboxId, }) => {
    var _a;
    const initialIsExpanded = isOpenDefault !== false;
    const [savedState, setSavedState] = useLocalStorage(getOptionGroupStorageKey(id), {
        isExpanded: initialIsExpanded,
    });
    const styles = useStyles2(getStyles);
    const [queryParams, updateQueryParams] = useQueryParams();
    const [isExpanded, setIsExpanded] = useState((_a = savedState === null || savedState === void 0 ? void 0 : savedState.isExpanded) !== null && _a !== void 0 ? _a : initialIsExpanded);
    const manualClickTime = useRef(0);
    const ref = useRef(null);
    const isOpenFromUrl = queryParams[CATEGORY_PARAM_NAME] === id;
    useEffect(() => {
        var _a;
        if (manualClickTime.current) {
            // ignore changes since the click handled the expected behavior
            if (Date.now() - manualClickTime.current < 200) {
                return;
            }
        }
        if (isOpenFromUrl || forceOpen) {
            if (!isExpanded) {
                setIsExpanded(true);
            }
            if (isOpenFromUrl) {
                (_a = ref.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView();
            }
        }
    }, [forceOpen, isExpanded, isOpenFromUrl]);
    const onToggle = useCallback(() => {
        manualClickTime.current = Date.now();
        updateQueryParams({
            [CATEGORY_PARAM_NAME]: isExpanded ? undefined : id,
        }, true);
        setSavedState({ isExpanded: !isExpanded });
        setIsExpanded(!isExpanded);
    }, [setSavedState, setIsExpanded, updateQueryParams, isExpanded, id]);
    if (!renderTitle) {
        renderTitle = function defaultTitle(isExpanded) {
            if (isExpanded || itemsCount === undefined || itemsCount === 0) {
                return title;
            }
            return (React.createElement("span", null,
                title,
                " ",
                React.createElement(Counter, { value: itemsCount })));
        };
    }
    const boxStyles = cx({
        [styles.box]: true,
        [styles.boxNestedExpanded]: isNested && isExpanded,
    }, className, 'options-group');
    const headerStyles = cx(styles.header, {
        [styles.headerExpanded]: isExpanded,
        [styles.headerNested]: isNested,
    });
    const bodyStyles = cx(styles.body, {
        [styles.bodyNested]: isNested,
    });
    return (React.createElement("div", { className: boxStyles, "data-testid": "options-category", "data-plugin-sandbox": sandboxId, "aria-label": selectors.components.OptionsGroup.group(id), ref: ref },
        React.createElement("div", { className: headerStyles, onClick: onToggle },
            React.createElement(Button, { "aria-label": selectors.components.OptionsGroup.toggle(id), type: "button", fill: "text", size: "sm", variant: "secondary", "aria-expanded": isExpanded, className: styles.toggleButton, icon: isExpanded ? 'angle-down' : 'angle-right', onClick: onToggle }),
            React.createElement("h6", { id: `button-${id}`, className: styles.title }, renderTitle(isExpanded))),
        isExpanded && (React.createElement("div", { className: bodyStyles, id: id, "aria-labelledby": `button-${id}` }, children))));
});
OptionsPaneCategory.displayName = 'OptionsPaneCategory';
const getStyles = (theme) => {
    return {
        box: css `
      border-top: 1px solid ${theme.colors.border.weak};
    `,
        boxNestedExpanded: css `
      margin-bottom: ${theme.spacing(2)};
    `,
        title: css `
      flex-grow: 1;
      overflow: hidden;
      line-height: 1.5;
      font-size: 1rem;
      padding-left: 6px;
      font-weight: ${theme.typography.fontWeightMedium};
      margin: 0;
    `,
        header: css `
      display: flex;
      cursor: pointer;
      align-items: center;
      padding: ${theme.spacing(0.5)};
      color: ${theme.colors.text.primary};
      font-weight: ${theme.typography.fontWeightMedium};

      &:hover {
        background: ${theme.colors.emphasize(theme.colors.background.primary, 0.03)};
      }
    `,
        toggleButton: css `
      align-self: baseline;
    `,
        headerExpanded: css `
      color: ${theme.colors.text.primary};
    `,
        headerNested: css `
      padding: ${theme.spacing(0.5, 0, 0.5, 0)};
    `,
        body: css `
      padding: ${theme.spacing(1, 2, 1, 4)};
    `,
        bodyNested: css `
      position: relative;
      padding-right: 0;
      &:before {
        content: '';
        position: absolute;
        top: 0;
        left: 8px;
        width: 1px;
        height: 100%;
        background: ${theme.colors.border.weak};
      }
    `,
    };
};
const getOptionGroupStorageKey = (id) => `${PANEL_EDITOR_UI_STATE_STORAGE_KEY}.optionGroup[${id}]`;
//# sourceMappingURL=OptionsPaneCategory.js.map