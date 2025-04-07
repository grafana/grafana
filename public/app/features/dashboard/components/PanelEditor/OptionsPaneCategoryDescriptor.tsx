import * as React from 'react';

import { Box } from '@grafana/ui';

import { OptionsPaneCategory } from './OptionsPaneCategory';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';

export interface OptionsPaneCategoryDescriptorProps {
  id: string;
  title: string;
  renderTitle?: (isExpanded: boolean) => React.ReactNode;
  isOpenDefault?: boolean;
  forceOpen?: boolean;
  className?: string;
  isNested?: boolean;
  itemsCount?: number;
  customRender?: () => React.ReactNode;
  sandboxId?: string;
  /**
   * When set will disable category and show tooltip with disabledText on
   */
  disabledText?: string;
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

  getCategory(name: string): OptionsPaneCategoryDescriptor {
    let sub = this.categories.find((c) => c.props.id === name);
    if (!sub) {
      sub = new OptionsPaneCategoryDescriptor({
        title: name,
        id: name,
      });
      this.addCategory(sub);
    }

    return sub;
  }

  render(searchQuery?: string) {
    if (this.props.customRender) {
      return this.props.customRender();
    }

    if (this.props.title === '') {
      return (
        <Box padding={2} paddingBottom={1} key={this.props.title}>
          {this.items.map((item) => item.render(searchQuery))}
        </Box>
      );
    }

    return (
      <OptionsPaneCategory key={this.props.title} {...this.props}>
        {this.items.map((item) => item.render(searchQuery))}
        {this.categories.map((category) => category.render(searchQuery))}
      </OptionsPaneCategory>
    );
  }
}
