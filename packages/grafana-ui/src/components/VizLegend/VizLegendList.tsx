import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
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
  limit = 0,
}: Props<T>) => {
  const styles = useStyles2(getStyles);

  const selectedCount = useMemo(() => items.filter((item) => !item.disabled).length, [items]);
  const allItemsSelected = items.length === selectedCount;

  if (!itemRenderer) {
    /* eslint-disable-next-line react/display-name */
    itemRenderer = (item) => (
      <VizLegendListItem
        item={item}
        onLabelClick={onLabelClick}
        onLabelMouseOver={onLabelMouseOver}
        onLabelMouseOut={onLabelMouseOut}
        readonly={readonly}
        allItemsSelected={allItemsSelected}
      />
    );
  }

  // split into left & right items when bottom/default legend, else everything goes in leftItems
  const leftItems = useMemo(
    () => (placement === 'right' ? items : items.filter((item) => item.yAxis === 1)),
    [placement, items]
  );
  const rightItems = useMemo(
    () => (placement === 'right' ? [] : items.filter((item) => item.yAxis !== 1)),
    [placement, items]
  );

  const getItemKey = (item: VizLegendItem<T>) => `${item.getItemKey ? item.getItemKey() : item.label}`;

  switch (placement) {
    case 'right': {
      const renderItem = (item: VizLegendItem<T>, index: number) => {
        return <span className={styles.itemRight}>{itemRenderer!(item, index)}</span>;
      };

      return (
        <div className={cx(styles.rightWrapper, className)}>
          <List items={leftItems} renderItem={renderItem} getItemKey={getItemKey} limit={limit} />
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
          {leftItems.length > 0 && (
            <div className={styles.section}>
              <InlineList items={leftItems} renderItem={renderItem} getItemKey={getItemKey} limit={limit} />
            </div>
          )}
          {rightItems.length > 0 && (
            <div className={cx(styles.section, styles.sectionRight)}>
              <InlineList items={rightItems} renderItem={renderItem} getItemKey={getItemKey} limit={limit} />
            </div>
          )}
        </div>
      );
    }
  }
};

VizLegendList.displayName = 'VizLegendList';

const getStyles = (theme: GrafanaTheme2) => {
  const itemStyles = css({
    paddingRight: '10px',
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'nowrap',
  });

  return {
    itemBottom: itemStyles,
    itemRight: cx(
      itemStyles,
      css({
        marginBottom: theme.spacing(0.5),
      })
    ),
    rightWrapper: css({
      padding: theme.spacing(0.5),
    }),
    bottomWrapper: css({
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      width: '100%',
      padding: theme.spacing(0.5),
      gap: '15px 25px',
    }),
    section: css({
      display: 'flex',
    }),
    sectionRight: css({
      justifyContent: 'flex-end',
      flexGrow: 1,
      flexBasis: '50%',
    }),
  };
};
