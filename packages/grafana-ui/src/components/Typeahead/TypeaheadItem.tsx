import { css, cx } from '@emotion/css';
import React from 'react';
import Highlighter from 'react-highlight-words';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { CompletionItem, CompletionItemKind } from '../../types/completion';

import { PartialHighlighter } from './PartialHighlighter';

interface Props {
  isSelected: boolean;
  item: CompletionItem;
  style: React.CSSProperties;
  prefix?: string;

  onClickItem?: (event: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const getStyles = (theme: GrafanaTheme2) => ({
  typeaheadItem: css({
    border: 'none',
    background: 'none',
    textAlign: 'left',
    label: 'type-ahead-item',
    height: 'auto',
    fontFamily: theme.typography.fontFamilyMonospace,
    padding: theme.spacing(1, 1, 1, 2),
    fontSize: theme.typography.bodySmall.fontSize,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    zIndex: 11,
    display: 'block',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition:
      'color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), border-color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), background 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), padding 0.15s cubic-bezier(0.645, 0.045, 0.355, 1)',
  }),

  typeaheadItemSelected: css({
    label: 'type-ahead-item-selected',
    backgroundColor: theme.colors.background.secondary,
  }),

  typeaheadItemMatch: css({
    label: 'type-ahead-item-match',
    color: theme.v1.palette.yellow,
    borderBottom: `1px solid ${theme.v1.palette.yellow}`,
    padding: 'inherit',
    background: 'inherit',
  }),

  typeaheadItemGroupTitle: css({
    label: 'type-ahead-item-group-title',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    padding: theme.spacing(1),
  }),
});

export const TypeaheadItem = (props: Props) => {
  const styles = useStyles2(getStyles);

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
    <li role="none">
      <button
        role="menuitem"
        className={className}
        style={style}
        onMouseDown={onClickItem}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        type="button"
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
      </button>
    </li>
  );
};
