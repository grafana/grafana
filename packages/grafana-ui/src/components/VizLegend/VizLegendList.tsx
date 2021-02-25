import React from 'react';
import { VizLegendBaseProps, VizLegendItem } from './types';
import { InlineList } from '../List/InlineList';
import { List } from '../List/List';
import { css, cx } from 'emotion';
import { useStyles } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { VizLegendListItem } from './VizLegendListItem';

export interface Props extends VizLegendBaseProps {}

/**
 * @internal
 */
export const VizLegendList: React.FunctionComponent<Props> = ({
  items,
  itemRenderer,
  onSeriesColorChange,
  onLabelClick,
  placement,
  className,
}) => {
  const styles = useStyles(getStyles);

  if (!itemRenderer) {
    /* eslint-disable-next-line react/display-name */
    itemRenderer = (item) => (
      <VizLegendListItem item={item} onLabelClick={onLabelClick} onSeriesColorChange={onSeriesColorChange} />
    );
  }

  const renderItem = (item: VizLegendItem, index: number) => {
    return <span className={styles.item}>{itemRenderer!(item, index)}</span>;
  };

  const getItemKey = (item: VizLegendItem) => `${item.label}`;

  switch (placement) {
    case 'right':
      return (
        <div className={cx(styles.rightWrapper, className)}>
          <List items={items} renderItem={renderItem} getItemKey={getItemKey} className={className} />
        </div>
      );
    case 'bottom':
    default:
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
};

VizLegendList.displayName = 'VizLegendList';

const getStyles = (theme: GrafanaTheme) => ({
  item: css`
    padding-right: 10px;
    display: flex;
    font-size: ${theme.typography.size.sm};
    white-space: nowrap;
    margin-bottom: ${theme.spacing.xs};
  `,
  rightWrapper: css`
    padding-left: ${theme.spacing.sm};
  `,
  bottomWrapper: css`
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    width: 100%;
    padding-left: ${theme.spacing.md};
  `,
  section: css`
    display: flex;
  `,
  sectionRight: css`
    justify-content: flex-end;
    flex-grow: 1;
  `,
});
