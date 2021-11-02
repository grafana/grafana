import { __assign } from "tslib";
import React from 'react';
import { OptionsPaneCategory } from './OptionsPaneCategory';
/**
 * This is not a real React component but an intermediary to enable deep option search without traversing a React node tree.
 */
var OptionsPaneCategoryDescriptor = /** @class */ (function () {
    function OptionsPaneCategoryDescriptor(props) {
        this.props = props;
        this.items = [];
        this.categories = [];
    }
    OptionsPaneCategoryDescriptor.prototype.addItem = function (item) {
        item.parent = this;
        this.items.push(item);
        return this;
    };
    OptionsPaneCategoryDescriptor.prototype.addCategory = function (category) {
        category.props.isNested = true;
        category.parent = this;
        this.categories.push(category);
        return this;
    };
    OptionsPaneCategoryDescriptor.prototype.getCategory = function (name) {
        var sub = this.categories.find(function (c) { return c.props.id === name; });
        if (sub) {
            return sub;
        }
        sub = new OptionsPaneCategoryDescriptor({
            title: name,
            id: name,
        });
        this.addCategory(sub);
        return sub;
    };
    OptionsPaneCategoryDescriptor.prototype.render = function (searchQuery) {
        if (this.props.customRender) {
            return this.props.customRender();
        }
        return (React.createElement(OptionsPaneCategory, __assign({ key: this.props.title }, this.props),
            this.items.map(function (item) { return item.render(); }),
            this.categories.map(function (category) { return category.render(); })));
    };
    return OptionsPaneCategoryDescriptor;
}());
export { OptionsPaneCategoryDescriptor };
//# sourceMappingURL=OptionsPaneCategoryDescriptor.js.map