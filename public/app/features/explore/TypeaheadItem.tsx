import React, { FunctionComponent, useContext } from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import { css, cx } from 'emotion';
import { GrafanaTheme, ThemeContext, selectThemeVariant } from '@grafana/ui';

import { CompletionItem } from 'app/types/explore';

interface Props {
  isSelected: boolean;
  item: CompletionItem;
  onClickItem: (suggestion: CompletionItem) => void;
  prefix?: string;
  style: any;
}

const getStyles = (theme: GrafanaTheme) => ({
  typeaheadItem: css`
    label: type-ahead-item;
    height: auto;
    font-family: ${theme.typography.fontFamily.monospace};
    padding: ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.md};
    font-size: ${theme.typography.size.sm};
    text-overflow: ellipsis;
    overflow: hidden;
    z-index: 1;
    display: block;
    white-space: nowrap;
    cursor: pointer;
    transition: color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), border-color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1),
      background 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), padding 0.15s cubic-bezier(0.645, 0.045, 0.355, 1);
  `,
  typeaheadItemSelected: css`
    label: type-ahead-item-selected;
    background-color: ${selectThemeVariant({ light: theme.colors.gray6, dark: theme.colors.dark9 }, theme.type)};
  `,
  typeaheadMatch: css`
    label: type-ahead-match;
    color: ${theme.colors.yellow};
    border-bottom: 1px solid ${theme.colors.yellow};
    padding: inherit;
    background: inherit;
  `,
  typeaheadItemHint: css`
    label: type-ahead-item-hint;
    font-size: ${theme.typography.size.xs};
    color: ${theme.colors.text};
    white-space: normal;
  `,
});

export const TypeaheadItem: FunctionComponent<Props> = (props: Props) => {
  const css = getStyles(useContext(ThemeContext));
  const { isSelected, item, prefix, style, onClickItem } = props;
  const onClick = () => onClickItem(item);
  const className = isSelected ? cx([css.typeaheadItem, css.typeaheadItemSelected]) : cx([css.typeaheadItem]);
  const highlightClassName = cx([css.typeaheadMatch]);
  const itemHintClassName = cx([css.typeaheadItemHint]);
  const label = item.label || '';

  return (
    <li className={className} onClick={onClick} style={style}>
      <Highlighter textToHighlight={label} searchWords={[prefix]} highlightClassName={highlightClassName} />
      {item.documentation && isSelected ? <div className={itemHintClassName}>{item.documentation}</div> : null}
    </li>
  );
};
