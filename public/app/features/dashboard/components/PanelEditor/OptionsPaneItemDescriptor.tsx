import React, { ReactNode } from 'react';
import Highlighter from 'react-highlight-words';

import { selectors } from '@grafana/e2e-selectors';
import { Field, Label } from '@grafana/ui';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemOverrides } from './OptionsPaneItemOverrides';
import { OptionPaneItemOverrideInfo } from './types';

export interface OptionsPaneItemProps {
  title: string;
  value?: any;
  description?: string;
  popularRank?: number;
  render: () => React.ReactNode;
  skipField?: boolean;
  showIf?: () => boolean;
  overrides?: OptionPaneItemOverrideInfo[];
}

/**
 * This is not a real React component but an intermediary to enable deep option search without traversing a React node tree.
 */
export class OptionsPaneItemDescriptor {
  parent!: OptionsPaneCategoryDescriptor;

  constructor(public props: OptionsPaneItemProps) {}

  getLabel(searchQuery?: string): ReactNode {
    const { title, description, overrides } = this.props;

    if (!searchQuery) {
      // Do not render label for categories with only one child
      if (this.parent.props.title === title && !overrides?.length) {
        return null;
      }

      return (
        <Label description={description}>
          {title}
          {overrides && overrides.length > 0 && <OptionsPaneItemOverrides overrides={overrides} />}
        </Label>
      );
    }

    const categories: React.ReactNode[] = [];

    if (this.parent.parent) {
      categories.push(this.highlightWord(this.parent.parent.props.title, searchQuery));
    }

    if (this.parent.props.title !== title) {
      categories.push(this.highlightWord(this.parent.props.title, searchQuery));
    }

    return (
      <Label description={description && this.highlightWord(description, searchQuery)} category={categories}>
        {this.highlightWord(title, searchQuery)}
        {overrides && overrides.length > 0 && <OptionsPaneItemOverrides overrides={overrides} />}
      </Label>
    );
  }

  highlightWord(word: string, query: string) {
    return (
      <Highlighter textToHighlight={word} searchWords={[query]} highlightClassName={'search-fragment-highlight'} />
    );
  }

  renderOverrides() {
    const { overrides } = this.props;
    if (!overrides || overrides.length === 0) {
      return;
    }
  }

  render(searchQuery?: string) {
    const { title, description, render, showIf, skipField } = this.props;
    const key = `${this.parent.props.id} ${title}`;

    if (showIf && !showIf()) {
      return null;
    }

    if (skipField) {
      return render();
    }

    return (
      <Field
        label={this.getLabel(searchQuery)}
        description={description}
        key={key}
        aria-label={selectors.components.PanelEditor.OptionsPane.fieldLabel(key)}
      >
        {render() as React.ReactElement}
      </Field>
    );
  }
}
