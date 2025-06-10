import { css, cx } from '@emotion/css';

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
      const leftItems = items.filter((item) => item.yAxis === 1);
      const rightItems = items.filter((item) => item.yAxis !== 1);

      const renderItem = (item: VizLegendItem<T>, index: number) => {
        return <span className={styles.itemBottom}>{itemRenderer!(item, index)}</span>;
      };

      return (
        <div className={cx(styles.bottomWrapper, className)}>
          {leftItems.length > 0 && (
            <div className={styles.section}>
              <InlineList items={leftItems} renderItem={renderItem} getItemKey={getItemKey} />
            </div>
          )}
          {rightItems.length > 0 && (
            <div className={cx(styles.section, styles.sectionRight)}>
              <InlineList items={rightItems} renderItem={renderItem} getItemKey={getItemKey} />
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
