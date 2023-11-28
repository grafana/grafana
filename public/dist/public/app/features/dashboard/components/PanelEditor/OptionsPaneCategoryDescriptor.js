import React from 'react';
import { OptionsPaneCategory } from './OptionsPaneCategory';
/**
 * This is not a real React component but an intermediary to enable deep option search without traversing a React node tree.
 */
export class OptionsPaneCategoryDescriptor {
    constructor(props) {
        this.props = props;
        this.items = [];
        this.categories = [];
    }
    addItem(item) {
        item.parent = this;
        this.items.push(item);
        return this;
    }
    addCategory(category) {
        category.props.isNested = true;
        category.parent = this;
        this.categories.push(category);
        return this;
    }
    getCategory(name) {
        let sub = this.categories.find((c) => c.props.id === name);
        if (sub) {
            return sub;
        }
        sub = new OptionsPaneCategoryDescriptor({
            title: name,
            id: name,
        });
        this.addCategory(sub);
        return sub;
    }
    render(searchQuery) {
        if (this.props.customRender) {
            return this.props.customRender();
        }
        return (React.createElement(OptionsPaneCategory, Object.assign({ key: this.props.title }, this.props),
            this.items.map((item) => item.render(searchQuery)),
            this.categories.map((category) => category.render(searchQuery))));
    }
}
//# sourceMappingURL=OptionsPaneCategoryDescriptor.js.map