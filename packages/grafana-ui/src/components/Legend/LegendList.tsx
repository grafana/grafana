import React, { useContext } from 'react';
import { LegendComponentProps, LegendItem } from './Legend';
import { InlineList } from '../List/InlineList';
import { List } from '../List/List';
import { css, cx } from 'emotion';
import { ThemeContext } from '../../themes/ThemeContext';

export const LegendList: React.FunctionComponent<LegendComponentProps> = ({
  items,
  itemRenderer,
  placement,
  className,
}) => {
  const theme = useContext(ThemeContext);

  const renderItem = (item: LegendItem, index: number) => {
    return (
      <span
        className={css`
          padding-left: 10px;
          display: flex;
          font-size: ${theme.typography.size.sm};
          white-space: nowrap;
        `}
      >
        {itemRenderer ? itemRenderer(item, index) : item.label}
      </span>
    );
  };

  const getItemKey = (item: LegendItem) => `${item.label}`;

  const styles = {
    wrapper: cx(
      css`
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        width: 100%;
      `,
      className
    ),
    section: css`
      display: flex;
    `,
    sectionRight: css`
      justify-content: flex-end;
      flex-grow: 1;
    `,
  };

  return placement === 'under' ? (
    <div className={styles.wrapper}>
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
