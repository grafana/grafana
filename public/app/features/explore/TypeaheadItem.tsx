import React, { FunctionComponent, useContext } from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import { css, cx } from 'emotion';
import { GrafanaTheme, ThemeContext, selectThemeVariant } from '@grafana/ui';

import { CompletionItem } from 'app/types/explore';

export const GROUP_TITLE_KIND = 'GroupTitle';

export const isGroupTitle = (item: CompletionItem) => {
  return item.kind && item.kind === GROUP_TITLE_KIND ? true : false;
};

interface Props {
  isSelected: boolean;
  item: CompletionItem;
  onClickItem: (suggestion: CompletionItem) => void;
  prefix?: string;
  style: any;
  onMouseEnter: (item: CompletionItem) => void;
  onMouseLeave: (item: CompletionItem) => void;
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
  typeaheadItemMatch: css`
    label: type-ahead-item-match;
    color: ${theme.colors.yellow};
    border-bottom: 1px solid ${theme.colors.yellow};
    padding: inherit;
    background: inherit;
  `,
  typeaheadItemGroupTitle: css`
    label: type-ahead-item-group-title;
    color: ${theme.colors.textWeak};
    font-size: ${theme.typography.size.sm};
    line-height: ${theme.typography.lineHeight.lg};
    padding: ${theme.spacing.sm};
  `,
});

export const TypeaheadItem: FunctionComponent<Props> = (props: Props) => {
  const theme = useContext(ThemeContext);
  const styles = getStyles(theme);

  const { isSelected, item, prefix, style, onClickItem } = props;
  const onClick = () => onClickItem(item);
  const onMouseEnter = () => props.onMouseEnter(item);
  const onMouseLeave = () => props.onMouseLeave(item);
  const className = isSelected ? cx([styles.typeaheadItem, styles.typeaheadItemSelected]) : cx([styles.typeaheadItem]);
  const highlightClassName = cx([styles.typeaheadItemMatch]);
  const itemGroupTitleClassName = cx([styles.typeaheadItemGroupTitle]);
  const label = item.label || '';

  if (isGroupTitle(item)) {
    return (
      <li className={itemGroupTitleClassName} style={style}>
        <span>{label}</span>
      </li>
    );
  }

  return (
    <li className={className} onClick={onClick} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <Highlighter textToHighlight={label} searchWords={[prefix]} highlightClassName={highlightClassName} />
    </li>
  );
};
