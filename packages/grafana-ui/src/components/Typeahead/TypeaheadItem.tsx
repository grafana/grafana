import { css, cx } from '@emotion/css';
import React from 'react';
import Highlighter from 'react-highlight-words';

import { GrafanaTheme } from '@grafana/data';

import { useStyles } from '../../themes/ThemeContext';
import { CompletionItem, CompletionItemKind } from '../../types/completion';

import { PartialHighlighter } from './PartialHighlighter';

interface Props {
  isSelected: boolean;
  item: CompletionItem;
  style: any;
  prefix?: string;

  onClickItem?: (event: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
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
    z-index: 11;
    display: block;
    white-space: nowrap;
    cursor: pointer;
    transition: color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), border-color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1),
      background 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), padding 0.15s cubic-bezier(0.645, 0.045, 0.355, 1);
  `,

  typeaheadItemSelected: css`
    label: type-ahead-item-selected;
    background-color: ${theme.colors.bg2};
  `,

  typeaheadItemMatch: css`
    label: type-ahead-item-match;
    color: ${theme.palette.yellow};
    border-bottom: 1px solid ${theme.palette.yellow};
    padding: inherit;
    background: inherit;
  `,

  typeaheadItemGroupTitle: css`
    label: type-ahead-item-group-title;
    color: ${theme.colors.textWeak};
    font-size: ${theme.typography.size.sm};
    line-height: ${theme.typography.lineHeight.md};
    padding: ${theme.spacing.sm};
  `,
});

export const TypeaheadItem = (props: Props) => {
  const styles = useStyles(getStyles);

  const { isSelected, item, prefix, style, onMouseEnter, onMouseLeave, onClickItem } = props;
  const className = isSelected ? cx([styles.typeaheadItem, styles.typeaheadItemSelected]) : cx([styles.typeaheadItem]);
  const highlightClassName = cx([styles.typeaheadItemMatch]);
  const itemGroupTitleClassName = cx([styles.typeaheadItemGroupTitle]);
  const label = item.label || '';

  if (item.kind === CompletionItemKind.GroupTitle) {
    return (
      <li className={itemGroupTitleClassName} style={style}>
        <span>{label}</span>
      </li>
    );
  }

  return (
    <li
      className={className}
      style={style}
      onMouseDown={onClickItem}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {item.highlightParts !== undefined ? (
        <PartialHighlighter
          text={label}
          highlightClassName={highlightClassName}
          highlightParts={item.highlightParts}
        ></PartialHighlighter>
      ) : (
        <Highlighter
          textToHighlight={label}
          searchWords={[prefix ?? '']}
          autoEscape={true}
          highlightClassName={highlightClassName}
        />
      )}
    </li>
  );
};
