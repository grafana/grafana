import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { InlineList } from '../List/InlineList';
import { List } from '../List/List';

import { VizLegendListItem } from './VizLegendListItem';
import { VizLegendBaseProps, VizLegendItem } from './types';

export interface Props<T> extends VizLegendBaseProps<T> {}

/**
 * @internal
 */
export const VizLegendList = <T extends unknown>({
  items,
  itemRenderer,
  onLabelMouseOver,
  onLabelMouseOut,
  onLabelClick,
  placement,
  className,
  readonly,
}: Props<T>) => {
  const styles = useStyles2(getStyles);

  if (!itemRenderer) {
    /* eslint-disable-next-line react/display-name */
    itemRenderer = (item) => (
      <VizLegendListItem
        item={item}
        onLabelClick={onLabelClick}
        onLabelMouseOver={onLabelMouseOver}
        onLabelMouseOut={onLabelMouseOut}
        readonly={readonly}
      />
    );
  }

  const getItemKey = (item: VizLegendItem<T>) => `${item.getItemKey ? item.getItemKey() : item.label}`;

  switch (placement) {
    case 'right': {
      const renderItem = (item: VizLegendItem<T>, index: number) => {
        return <span className={styles.itemRight}>{itemRenderer!(item, index)}</span>;
      };

      return (
        <div className={cx(styles.rightWrapper, className)}>
          <List items={items} renderItem={renderItem} getItemKey={getItemKey} />
        </div>
      );
    }
    case 'bottom':
    default: {
      const renderItem = (item: VizLegendItem<T>, index: number) => {
        return <span className={styles.itemBottom}>{itemRenderer!(item, index)}</span>;
      };

      return (
        <div className={cx(styles.bottomWrapper, className)}>
          <div className={styles.section}>
            <InlineList
              items={items.filter((item) => item.yAxis === 1)}
              renderItem={renderItem}
              getItemKey={getItemKey}
            />
          </div>
          <div className={cx(styles.section, styles.sectionRight)}>
            <InlineList
              items={items.filter((item) => item.yAxis !== 1)}
              renderItem={renderItem}
              getItemKey={getItemKey}
            />
          </div>
        </div>
      );
    }
  }
};

VizLegendList.displayName = 'VizLegendList';

const getStyles = (theme: GrafanaTheme2) => {
  const itemStyles = css`
    padding-right: 10px;
    display: flex;
    font-size: ${theme.typography.bodySmall.fontSize};
    white-space: nowrap;
  `;

  return {
    itemBottom: itemStyles,
    itemRight: cx(
      itemStyles,
      css`
        margin-bottom: ${theme.spacing(0.5)};
      `
    ),
    rightWrapper: css`
      padding-left: ${theme.spacing(0.5)};
    `,
    bottomWrapper: css`
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      width: 100%;
      padding-left: ${theme.spacing(0.5)};
    `,
    section: css`
      display: flex;
    `,
    sectionRight: css`
      justify-content: flex-end;
      flex-grow: 1;
    `,
  };
};
