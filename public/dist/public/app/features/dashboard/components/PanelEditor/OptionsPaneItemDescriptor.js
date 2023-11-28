import { css } from '@emotion/css';
import React from 'react';
import Highlighter from 'react-highlight-words';
import { selectors } from '@grafana/e2e-selectors';
import { Field, Label, useStyles2 } from '@grafana/ui';
import { OptionsPaneItemOverrides } from './OptionsPaneItemOverrides';
/**
 * This is not a real React component but an intermediary to enable deep option search without traversing a React node tree.
 */
export class OptionsPaneItemDescriptor {
    constructor(props) {
        this.props = props;
    }
    getLabel(searchQuery) {
        const { title, description, overrides, addon } = this.props;
        if (!searchQuery) {
            // Do not render label for categories with only one child
            if (this.parent.props.title === title && !(overrides === null || overrides === void 0 ? void 0 : overrides.length)) {
                return null;
            }
            return React.createElement(OptionPaneLabel, { title: title, description: description, overrides: overrides, addon: addon });
        }
        const categories = [];
        if (this.parent.parent) {
            categories.push(this.highlightWord(this.parent.parent.props.title, searchQuery));
        }
        if (this.parent.props.title !== title) {
            categories.push(this.highlightWord(this.parent.props.title, searchQuery));
        }
        return (React.createElement(Label, { description: description && this.highlightWord(description, searchQuery), category: categories },
            this.highlightWord(title, searchQuery),
            overrides && overrides.length > 0 && React.createElement(OptionsPaneItemOverrides, { overrides: overrides })));
    }
    highlightWord(word, query) {
        return (React.createElement(Highlighter, { textToHighlight: word, searchWords: [query], highlightClassName: 'search-fragment-highlight' }));
    }
    renderOverrides() {
        const { overrides } = this.props;
        if (!overrides || overrides.length === 0) {
            return;
        }
    }
    render(searchQuery) {
        const { title, description, render, showIf, skipField } = this.props;
        const key = `${this.parent.props.id} ${title}`;
        if (showIf && !showIf()) {
            return null;
        }
        if (skipField) {
            return render();
        }
        return (React.createElement(Field, { label: this.getLabel(searchQuery), description: description, key: key, "aria-label": selectors.components.PanelEditor.OptionsPane.fieldLabel(key) }, render()));
    }
}
function OptionPaneLabel({ title, description, overrides, addon }) {
    const styles = useStyles2(getLabelStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement(Label, { description: description },
            title,
            overrides && overrides.length > 0 && React.createElement(OptionsPaneItemOverrides, { overrides: overrides })),
        addon));
}
function getLabelStyles(theme) {
    return {
        container: css `
      display: flex;
      justify-content: space-between;
    `,
    };
}
//# sourceMappingURL=OptionsPaneItemDescriptor.js.map