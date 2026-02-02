import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Icon, stylesFactory, useTheme2 } from '@grafana/ui';

export interface TagListProps {
  tags: SelectableValue[];
  onRemove?: (selected: SelectableValue[], removedItem: SelectableValue) => void;
  getTitle: (item: SelectableValue) => string;
  tagClass?: string;
  getTooltip: (itme: SelectableValue) => string;
}

export const TagList: React.FC<TagListProps> = (props: TagListProps) => {
  const theme = useTheme2();
  const styles = getResultsItemStyles(theme);
  const [showRemove, setShowRemove] = useState({} as { [key: string]: boolean });

  const onRemoveItem = (removeItem: SelectableValue) => {
    const newItems = props.tags.filter((item) => item !== removeItem);

    if (props.onRemove) {
      props.onRemove(newItems, removeItem);
    }
  };

  const tagStyle = {
    crossIcon: {
      opacity: '0',
      transition: 'all ease-out .2s',
      cursor: 'pointer',
    },
    active: {
      opacity: '1',
      transition: 'all ease-out .2s',
      cursor: 'pointer',
    },
    label: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      left: '8px',
      position: 'relative' as 'relative',
      transition: 'left ease-out .2s',
    },
    activel: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      left: '0',
      position: 'relative' as 'relative',
      transition: 'left ease-out .2s',
    },
  };

  const getLabelStyle = (index: number) => {
    if (!props.onRemove) {
      return {};
    }
    return showRemove['tag-' + index] ? tagStyle.activel : tagStyle.label;
  };

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', maxWidth: '1024px' }}>
        {props.tags?.length > 0 &&
          props.tags.map((item, index) => {
            return (
              <div
                data-testid={'domain-picker-selected-tag-item-' + index}
                key={'tag-' + index}
                className={styles.itemContainer}
                onMouseEnter={() => setShowRemove({ ['tag-' + index]: true })}
                onMouseLeave={() => setShowRemove({ ['tag-' + index]: false })}
              >
                <span title={props.getTooltip(item)} style={getLabelStyle(index)}>
                  {props.getTitle(item)}
                </span>

                {props.onRemove && (
                  <Icon
                    name="times"
                    onClick={() => onRemoveItem(item)}
                    style={showRemove['tag-' + index] ? tagStyle.active : tagStyle.crossIcon}
                    title="Remove item"
                  />
                )}
              </div>
            );
          })}
      </div>
    </>
  );
};

const getResultsItemStyles = stylesFactory((theme: GrafanaTheme2) => ({
  itemContainer: css`
    color: ${theme.colors.text.primary};
    font-size: ${'12px'};
    line-height: ${theme.typography.bodySmall.lineHeight};
    max-width: fit-content;
    position: relative;
    height: 32px;
    line-height: 22px;
    background-color: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: 3px;
    margin-bottom: 3px;
    margin-right: 3px;
    white-space: nowrap;
    text-shadow: none;
    font-weight: 500;
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 180px;
    min-width: 180px;
  `,
}));
