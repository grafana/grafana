import { css, cx } from '@emotion/css';
import React, { useId } from 'react';
import Highlighter from 'react-highlight-words';
import { FieldConfigProperty, } from '@grafana/data';
import { Counter, Field, HorizontalGroup, IconButton, Label, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategory } from './OptionsPaneCategory';
export const DynamicConfigValueEditor = ({ property, context, registry, onChange, onRemove, isSystemOverride, searchQuery, }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const item = registry === null || registry === void 0 ? void 0 : registry.getIfExists(property.id);
    const componentId = useId();
    if (!item) {
        return null;
    }
    const isCollapsible = Array.isArray(property.value) ||
        property.id === FieldConfigProperty.Thresholds ||
        property.id === FieldConfigProperty.Links ||
        property.id === FieldConfigProperty.Mappings;
    const labelCategory = (_a = item.category) === null || _a === void 0 ? void 0 : _a.filter((c) => c !== item.name);
    let editor;
    /* eslint-disable react/display-name */
    const renderLabel = (includeDescription = true, includeCounter = false) => (isExpanded = false) => (React.createElement(HorizontalGroup, { justify: "space-between" },
        React.createElement(Label, { category: labelCategory, description: includeDescription ? item.description : undefined, htmlFor: componentId },
            React.createElement(Highlighter, { textToHighlight: item.name, searchWords: [searchQuery], highlightClassName: 'search-fragment-highlight' }),
            !isExpanded && includeCounter && item.getItemsCount && (React.createElement(Counter, { value: item.getItemsCount(property.value) }))),
        !isSystemOverride && (React.createElement("div", null,
            React.createElement(IconButton, { name: "times", onClick: onRemove, tooltip: "Remove label" })))));
    /* eslint-enable react/display-name */
    if (isCollapsible) {
        editor = (React.createElement(OptionsPaneCategory, { id: item.name, renderTitle: renderLabel(false, true), className: css `
          padding-left: 0;
          padding-right: 0;
        `, isNested: true, isOpenDefault: property.value !== undefined },
            React.createElement(item.override, { value: property.value, onChange: (value) => {
                    onChange(value);
                }, item: item, context: context })));
    }
    else {
        editor = (React.createElement("div", null,
            React.createElement(Field, { label: renderLabel()(), description: item.description },
                React.createElement(item.override, { value: property.value, onChange: (value) => {
                        onChange(value);
                    }, item: item, context: context, id: componentId }))));
    }
    return (React.createElement("div", { className: cx(isCollapsible && styles.collapsibleOverrideEditor, !isCollapsible && 'dynamicConfigValueEditor--nonCollapsible') }, editor));
};
const getStyles = (theme) => {
    return {
        collapsibleOverrideEditor: css `
      label: collapsibleOverrideEditor;
      & + .dynamicConfigValueEditor--nonCollapsible {
        margin-top: ${theme.spacing(1)};
      }
    `,
    };
};
//# sourceMappingURL=DynamicConfigValueEditor.js.map