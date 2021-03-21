import { Field } from '@grafana/ui';
import React, { ReactElement } from 'react';
import { OptionsPaneCategory } from './OptionsPaneCategory';

export interface OptionsPaneItemProps {
  title: string;
  value?: any;
  description?: string;
  render: () => ReactElement;
  skipLabel?: boolean;
}

/**
 * This is not a real React component but an intermediary to enable deep option search without traversing a React node tree.
 */
export class OptionsPaneItemDescriptor {
  parent!: OptionsPaneCategoryDescriptor;

  constructor(public props: OptionsPaneItemProps) {}

  render() {
    const { title, description, render } = this.props;
    const key = `${this.parent.props.id}${title}`;

    return (
      <Field label={title} description={description} key={key}>
        {render()}
      </Field>
    );
  }
}

export interface OptionsPaneCategoryProps {
  id: string;
  title?: string;
  renderTitle?: (isExpanded: boolean) => React.ReactNode;
  defaultToClosed?: boolean;
  className?: string;
  nested?: boolean;
  customRender?: () => React.ReactNode;
}

/**
 * This is not a real React component but an intermediary to enable deep option search without traversing a React node tree.
 */
export class OptionsPaneCategoryDescriptor {
  items: OptionsPaneItemDescriptor[] = [];
  categories: OptionsPaneCategoryDescriptor[] = [];
  parent!: OptionsPaneCategoryDescriptor;

  constructor(public props: OptionsPaneCategoryProps) {}

  addItem(item: OptionsPaneItemDescriptor) {
    item.parent = this;
    this.items.push(item);
    return this;
  }

  addCategory(category: OptionsPaneCategoryDescriptor) {
    category.props.nested = true;
    category.parent = this;
    this.categories.push(category);
    return this;
  }

  render() {
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
