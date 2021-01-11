import React, { useContext } from 'react';
import { LegendBaseProps, LegendItem } from './types';
import { InlineList } from '../List/InlineList';
import { List } from '../List/List';
import { css, cx } from 'emotion';
import { ThemeContext } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { LegendListItem } from './LegendListItem';

export interface Props extends LegendBaseProps {}

export const LegendList: React.FunctionComponent<Props> = ({
  items,
  itemRenderer,
  onSeriesColorChange,
  onLabelClick,
  placement,
  className,
}) => {
  const theme = useContext(ThemeContext);
  const styles = getStyles(theme);

  if (!itemRenderer) {
    /* eslint-disable-next-line react/display-name */
    itemRenderer = item => (
      <LegendListItem item={item} onLabelClick={onLabelClick} onSeriesColorChange={onSeriesColorChange} />
    );
  }

  const renderItem = (item: LegendItem, index: number) => {
    return <span className={styles.item}>{itemRenderer!(item, index)}</span>;
  };

  const getItemKey = (item: LegendItem) => `${item.label}`;

  return placement === 'bottom' ? (
    <div className={cx(styles.wrapper, className)}>
      <div className={styles.section}>
        <InlineList items={items.filter(item => item.yAxis === 1)} renderItem={renderItem} getItemKey={getItemKey} />
      </div>
      <div className={cx(styles.section, styles.sectionRight)}>
        <InlineList items={items.filter(item => item.yAxis !== 1)} renderItem={renderItem} getItemKey={getItemKey} />
      </div>
    </div>
  ) : (
    <List items={items} renderItem={renderItem} getItemKey={getItemKey} className={className} />
  );
};

LegendList.displayName = 'LegendList';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  item: css`
    padding-right: 10px;
    display: flex;
    font-size: ${theme.typography.size.sm};
    white-space: nowrap;
    margin-bottom: ${theme.spacing.xs};
  `,
  wrapper: css`
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    width: 100%;
    margin-left: ${theme.spacing.md};
  `,
  section: css`
    display: flex;
  `,
  sectionRight: css`
    justify-content: flex-end;
    flex-grow: 1;
  `,
}));
