import { Field, Label } from '@grafana/ui';
import React, { ComponentType } from 'react';
import { OptionsPaneCategory } from './OptionsPaneCategory';

export interface OptionsPaneItemProps {
  title: string;
  value?: any;
  description?: string;
  Component: ComponentType;
  skipLabel?: boolean;
}

/**
 * This is not a real React component but an intermediary to enable deep option search without traversing a React node tree.
 */
export class OptionsPaneItemDescriptor {
  parent!: OptionsPaneCategoryDescriptor;

  constructor(public props: OptionsPaneItemProps) {}

  getLabel(isSearching?: boolean) {
    const { title, description } = this.props;

    if (!isSearching) {
      return title;
    }

    const categories: string[] = [];
    categories.push(this.parent.props.title);
    if (this.parent.parent) {
      categories.push(this.parent.parent.props.title);
    }
    return (
      <Label description={description} category={categories}>
        {title}
      </Label>
    );
  }

  render(isSearching?: boolean) {
    const { title, description, Component } = this.props;
    const key = `${this.parent.props.id}${title}`;

    return (
      <Field label={this.getLabel(isSearching)} description={description} key={key}>
        <Component />
      </Field>
    );
  }
}

export interface OptionsPaneCategoryProps {
  id: string;
  title: string;
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
  parent?: OptionsPaneCategoryDescriptor;

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
