import React, { useContext } from 'react';
import { LegendComponentProps } from './Legend';
import { InlineList } from '../List/InlineList';
import { css } from 'emotion';
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

  return (
    <InlineList
      items={items}
      renderItem={item => {
        return (
          <span
            className={css`
              padding-left: 10px;
              display: flex;
              font-size: ${theme.typography.size.sm};
            `}
          >
            <>{itemRenderer ? itemRenderer(item) : item.label}</>
            {statsToDisplay && (
              <LegendStatsList stats={item.stats.filter(stat => statsToDisplay.indexOf(stat.statId) > -1)} />
            )}
          </span>
        );
      }}
    />
  );
};

LegendList.displayName = 'LegendList';
