import { selectors } from '@grafana/e2e-selectors';
import { Field, Label } from '@grafana/ui';
import React, { ReactNode } from 'react';
import Highlighter from 'react-highlight-words';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';

export interface OptionsPaneItemProps {
  title: string;
  value?: any;
  description?: string;
  popularRank?: number;
  render: () => React.ReactNode;
  skipField?: boolean;
  showIf?: () => boolean;
}

/**
 * This is not a real React component but an intermediary to enable deep option search without traversing a React node tree.
 */
export class OptionsPaneItemDescriptor {
  parent!: OptionsPaneCategoryDescriptor;

  constructor(public props: OptionsPaneItemProps) {}

  getLabel(searchQuery?: string): ReactNode {
    const { title, description } = this.props;

    if (!searchQuery) {
      // Do not render label for categories with only one child
      if (this.parent.props.title === title) {
        return null;
      }

      return title;
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
      </Label>
    );
  }

  highlightWord(word: string, query: string) {
    return (
      <Highlighter textToHighlight={word} searchWords={[query]} highlightClassName={'search-fragment-highlight'} />
    );
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
