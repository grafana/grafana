import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Tooltip, withTheme2, clearButtonStyles, stylesFactory } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { ALL_VARIABLE_VALUE } from '../../constants';
class VariableOptions extends PureComponent {
    constructor() {
        super(...arguments);
        this.onToggle = (option) => (event) => {
            const clearOthers = event.shiftKey || event.ctrlKey || event.metaKey;
            this.handleEvent(event);
            this.props.onToggle(option, clearOthers);
        };
        this.onToggleAll = (event) => {
            this.handleEvent(event);
            this.props.onToggleAll();
        };
    }
    handleEvent(event) {
        event.preventDefault();
        event.stopPropagation();
    }
    render() {
        // Don't want to pass faulty rest props to the div
        const _a = this.props, { multi, values, highlightIndex, selectedValues, onToggle, onToggleAll, theme } = _a, restProps = __rest(_a, ["multi", "values", "highlightIndex", "selectedValues", "onToggle", "onToggleAll", "theme"]);
        const styles = getStyles(theme);
        return (React.createElement("div", { className: styles.variableValueDropdown },
            React.createElement("div", { className: styles.variableOptionsWrapper },
                React.createElement("ul", Object.assign({ className: styles.variableOptionsColumn, "aria-label": selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown }, restProps),
                    this.renderMultiToggle(),
                    values.map((option, index) => this.renderOption(option, index))))));
    }
    renderOption(option, index) {
        const { highlightIndex, multi, theme } = this.props;
        const styles = getStyles(theme);
        const isAllOption = option.value === ALL_VARIABLE_VALUE;
        return (React.createElement("li", { key: `${option.value}` },
            React.createElement("button", { "data-testid": selectors.components.Variables.variableOption, role: "checkbox", type: "button", "aria-checked": option.selected, className: cx(clearButtonStyles(theme), styles.variableOption, {
                    [styles.highlighted]: index === highlightIndex,
                    [styles.variableAllOption]: isAllOption,
                }, styles.noStyledButton), onClick: this.onToggle(option) },
                React.createElement("span", { className: cx(styles.variableOptionIcon, {
                        [styles.variableOptionIconSelected]: option.selected,
                        [styles.hideVariableOptionIcon]: !multi,
                    }) }),
                React.createElement("span", { "data-testid": selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(`${option.text}`) }, isAllOption ? t('variable.picker.option-all', 'All') : option.text))));
    }
    renderMultiToggle() {
        const { multi, selectedValues, theme, values } = this.props;
        const styles = getStyles(theme);
        const isAllOptionConfigured = values.some((option) => option.value === ALL_VARIABLE_VALUE);
        if (!multi) {
            return null;
        }
        const tooltipContent = () => React.createElement(Trans, { i18nKey: "variable.picker.option-tooltip" }, "Clear selections");
        return (React.createElement(Tooltip, { content: tooltipContent, placement: 'top' },
            React.createElement("button", { className: cx(clearButtonStyles(theme), styles.variableOption, styles.variableOptionColumnHeader, styles.noStyledButton, { [styles.noPaddingBotton]: isAllOptionConfigured }), role: "checkbox", "aria-checked": selectedValues.length > 1 ? 'mixed' : 'false', onClick: this.onToggleAll, "aria-label": "Toggle all values", "data-placement": "top" },
                React.createElement("span", { className: cx(styles.variableOptionIcon, {
                        [styles.variableOptionIconManySelected]: selectedValues.length > 1,
                    }) }),
                React.createElement(Trans, { i18nKey: "variable.picker.option-selected-values" }, "Selected"),
                " (",
                selectedValues.length,
                ")")));
    }
}
const getStyles = stylesFactory((theme) => {
    const checkboxImageUrl = theme.isDark ? 'public/img/checkbox.png' : 'public/img/checkbox_white.png';
    return {
        hideVariableOptionIcon: css({
            display: 'none',
        }),
        highlighted: css({
            backgroundColor: theme.colors.action.hover,
        }),
        noStyledButton: css({
            width: '100%',
            textAlign: 'left',
        }),
        variableOption: css({
            display: 'block',
            padding: '2px 27px 0 8px',
            position: 'relative',
            whiteSpace: 'nowrap',
            minWidth: '115px',
            ['&:hover']: {
                backgroundColor: theme.colors.action.hover,
            },
        }),
        variableOptionColumnHeader: css({
            paddingTop: '5px',
            paddingBottom: '5px',
            marginBottom: '5px',
        }),
        variableOptionIcon: css({
            display: 'inline-block',
            width: '24px',
            height: '18px',
            position: 'relative',
            top: '4px',
            background: `url(${checkboxImageUrl}) left top no-repeat`,
        }),
        variableOptionIconManySelected: css({
            background: `url(${checkboxImageUrl}) 0px -36px no-repeat`,
        }),
        variableOptionIconSelected: css({
            background: `url(${checkboxImageUrl}) 0px -18px no-repeat`,
        }),
        variableValueDropdown: css({
            backgroundColor: theme.colors.background.primary,
            border: `1px solid ${theme.colors.border.weak}`,
            borderRadius: theme.shape.borderRadius(2),
            boxShadow: theme.shadows.z2,
            position: 'absolute',
            top: theme.spacing(theme.components.height.md),
            maxHeight: '400px',
            minHeight: '150px',
            minWidth: '150px',
            overflowY: 'auto',
            overflowX: 'hidden',
            zIndex: theme.zIndex.typeahead,
        }),
        variableOptionsColumn: css({
            maxHeight: '350px',
            display: 'table-cell',
            lineHeight: '26px',
            listStyleType: 'none',
        }),
        variableOptionsWrapper: css({
            display: 'table',
            width: '100%',
        }),
        variableAllOption: css({
            borderBottom: `1px solid ${theme.colors.border.weak}`,
            paddingBottom: theme.spacing(1),
        }),
        noPaddingBotton: css({
            paddingBottom: 0,
        }),
    };
});
export default withTheme2(VariableOptions);
//# sourceMappingURL=VariableOptions.js.map