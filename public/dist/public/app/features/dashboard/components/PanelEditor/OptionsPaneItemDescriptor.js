import { selectors } from '@grafana/e2e-selectors';
import { Field, Label } from '@grafana/ui';
import React from 'react';
import Highlighter from 'react-highlight-words';
/**
 * This is not a real React component but an intermediary to enable deep option search without traversing a React node tree.
 */
var OptionsPaneItemDescriptor = /** @class */ (function () {
    function OptionsPaneItemDescriptor(props) {
        this.props = props;
    }
    OptionsPaneItemDescriptor.prototype.getLabel = function (searchQuery) {
        var _a = this.props, title = _a.title, description = _a.description;
        if (!searchQuery) {
            // Do not render label for categories with only one child
            if (this.parent.props.title === title) {
                return null;
            }
            return title;
        }
        var categories = [];
        if (this.parent.parent) {
            categories.push(this.highlightWord(this.parent.parent.props.title, searchQuery));
        }
        if (this.parent.props.title !== title) {
            categories.push(this.highlightWord(this.parent.props.title, searchQuery));
        }
        return (React.createElement(Label, { description: description && this.highlightWord(description, searchQuery), category: categories }, this.highlightWord(title, searchQuery)));
    };
    OptionsPaneItemDescriptor.prototype.highlightWord = function (word, query) {
        return (React.createElement(Highlighter, { textToHighlight: word, searchWords: [query], highlightClassName: 'search-fragment-highlight' }));
    };
    OptionsPaneItemDescriptor.prototype.render = function (searchQuery) {
        var _a = this.props, title = _a.title, description = _a.description, render = _a.render, showIf = _a.showIf, skipField = _a.skipField;
        var key = this.parent.props.id + " " + title;
        if (showIf && !showIf()) {
            return null;
        }
        if (skipField) {
            return render();
        }
        return (React.createElement(Field, { label: this.getLabel(searchQuery), description: description, key: key, "aria-label": selectors.components.PanelEditor.OptionsPane.fieldLabel(key) }, render()));
    };
    return OptionsPaneItemDescriptor;
}());
export { OptionsPaneItemDescriptor };
//# sourceMappingURL=OptionsPaneItemDescriptor.js.map