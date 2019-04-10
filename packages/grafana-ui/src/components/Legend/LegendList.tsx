import React, { useContext } from 'react';
import { LegendComponentProps, LegendItem } from './Legend';
import { InlineList } from '../List/InlineList';
import { css, cx } from 'emotion';
import { ThemeContext } from '../../themes/ThemeContext';

const LegendItemStat: React.FunctionComponent<{ statName: string; value: number }> = ({ statName, value }) => {
  return (
    <div
      className={css`
        margin-left: 6px;
      `}
    >
      {statName}: {value}
    </div>
  );
};

LegendItemStat.displayName = 'LegendItemStat';

const LegendStatsList: React.FunctionComponent<{ stats: Array<{ statId: string; value: number }> }> = ({ stats }) => {
  if (stats.length === 0) {
    return null;
  }
  return <InlineList items={stats} renderItem={stat => <LegendItemStat statName={stat.statId} value={stat.value} />} />;
};

LegendStatsList.displayName = 'LegendStatsList';

export const LegendList: React.FunctionComponent<LegendComponentProps> = ({ items, itemRenderer, statsToDisplay }) => {
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
        <>{itemRenderer ? itemRenderer(item) : item.label}</>
        {statsToDisplay && (
          <LegendStatsList stats={item.stats.filter(stat => statsToDisplay.indexOf(stat.statId) > -1)} />
        )}
      </span>
    );
  };

  const getItemKey = (item: LegendItem) => item.label;

  const styles = {
    wrapper: css`
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      width: 100%;
    `,
    section: css`
      display: flex;
    `,
    sectionRight: css`
      justify-content: flex-end;
      flex-grow: 1;
    `,
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.section}>
        <InlineList items={items.filter(item => !item.useRightYAxis)} renderItem={renderItem} getItemKey={getItemKey} />
      </div>
      <div className={cx(styles.section, styles.sectionRight)}>
        <InlineList items={items.filter(item => item.useRightYAxis)} renderItem={renderItem} getItemKey={getItemKey} />
      </div>
    </div>
  );
};

LegendList.displayName = 'LegendList';
