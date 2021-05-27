import React from 'react';
import { OptionsPaneCategory } from './OptionsPaneCategory';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';

export interface OptionsPaneCategoryDescriptorProps {
  id: string;
  title: string;
  renderTitle?: (isExpanded: boolean) => React.ReactNode;
  isOpenDefault?: boolean;
  forceOpen?: number;
  className?: string;
  isNested?: boolean;
  itemsCount?: number;
  customRender?: () => React.ReactNode;
}
/**
 * This is not a real React component but an intermediary to enable deep option search without traversing a React node tree.
 */

export class OptionsPaneCategoryDescriptor {
  items: OptionsPaneItemDescriptor[] = [];
  categories: OptionsPaneCategoryDescriptor[] = [];
  parent?: OptionsPaneCategoryDescriptor;

  constructor(public props: OptionsPaneCategoryDescriptorProps) {}

  addItem(item: OptionsPaneItemDescriptor) {
    item.parent = this;
    this.items.push(item);
    return this;
  }

  addCategory(category: OptionsPaneCategoryDescriptor) {
    category.props.isNested = true;
    category.parent = this;
    this.categories.push(category);
    return this;
  }

  render(searchQuery?: string) {
    if (this.props.customRender) {
      return this.props.customRender();
    }

    return (
      <OptionsPaneCategory key={this.props.title} {...this.props}>
        {this.items.map((item) => item.render())}
        {this.categories.map((category) => category.render())}
      </OptionsPaneCategory>
    );
  }
}
