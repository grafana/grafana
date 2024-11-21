import { css } from '@emotion/css';
import { ReactNode } from 'react';
import * as React from 'react';
import Highlighter from 'react-highlight-words';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Field, Label, useStyles2 } from '@grafana/ui';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemOverrides } from './OptionsPaneItemOverrides';
import { OptionPaneItemOverrideInfo } from './types';

export interface OptionsPaneItemInfo {
  title: string;
  value?: any;
  description?: string;
  popularRank?: number;
  render: () => React.ReactElement;
  skipField?: boolean;
  showIf?: () => boolean;
  /** Hook for controlling visibility */
  useShowIf?: () => boolean;
  overrides?: OptionPaneItemOverrideInfo[];
  addon?: ReactNode;
}

/**
 * This is not a real React component but an intermediary to enable deep option search without traversing a React node tree.
 */
export class OptionsPaneItemDescriptor {
  parent!: OptionsPaneCategoryDescriptor;

  constructor(public props: OptionsPaneItemInfo) {}

  render(searchQuery?: string) {
    return <OptionsPaneItem key={this.props.title} itemDescriptor={this} searchQuery={searchQuery} />;
  }

  useShowIf() {
    if (this.props.useShowIf) {
      return this.props.useShowIf();
    }

    if (this.props.showIf) {
      return this.props.showIf();
    }

    return true;
  }
}

interface OptionsPaneItemProps {
  itemDescriptor: OptionsPaneItemDescriptor;
  searchQuery?: string;
}

function OptionsPaneItem({ itemDescriptor, searchQuery }: OptionsPaneItemProps) {
  const { title, description, render, skipField } = itemDescriptor.props;
  const key = `${itemDescriptor.parent.props.id} ${title}`;
  const showIf = itemDescriptor.useShowIf();

  if (!showIf) {
    return null;
  }

  if (skipField) {
    return render();
  }

  return (
    <Field
      label={renderOptionLabel(itemDescriptor, searchQuery)}
      description={description}
      key={key}
      aria-label={selectors.components.PanelEditor.OptionsPane.fieldLabel(key)}
    >
      {render()}
    </Field>
  );
}

function renderOptionLabel(itemDescriptor: OptionsPaneItemDescriptor, searchQuery?: string): ReactNode {
  const { title, description, overrides, addon } = itemDescriptor.props;

  if (!searchQuery) {
    // Do not render label for categories with only one child
    if (itemDescriptor.parent.props.title === title && !overrides?.length) {
      return null;
    }

    return <OptionPaneLabel title={title} description={description} overrides={overrides} addon={addon} />;
  }

  const categories: React.ReactNode[] = [];

  if (itemDescriptor.parent.parent) {
    categories.push(highlightWord(itemDescriptor.parent.parent.props.title, searchQuery));
  }

  if (itemDescriptor.parent.props.title !== title) {
    categories.push(highlightWord(itemDescriptor.parent.props.title, searchQuery));
  }

  return (
    <Label description={description && highlightWord(description, searchQuery)} category={categories}>
      {highlightWord(title, searchQuery)}
      {overrides && overrides.length > 0 && <OptionsPaneItemOverrides overrides={overrides} />}
    </Label>
  );
}

function highlightWord(word: string, query: string) {
  return <Highlighter textToHighlight={word} searchWords={[query]} highlightClassName={'search-fragment-highlight'} />;
}

interface OptionPanelLabelProps {
  title: string;
  description?: string;
  overrides?: OptionPaneItemOverrideInfo[];
  addon: ReactNode;
}

function OptionPaneLabel({ title, description, overrides, addon }: OptionPanelLabelProps) {
  const styles = useStyles2(getLabelStyles);
  return (
    <div className={styles.container}>
      <Label description={description}>
        {title}
        {overrides && overrides.length > 0 && <OptionsPaneItemOverrides overrides={overrides} />}
      </Label>
      {addon}
    </div>
  );
}

function getLabelStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      justifyContent: 'space-between',
    }),
  };
}
