import React from 'react';
import { StatDisplayValue } from './Legend';
import { InlineList } from '../List/InlineList';
import { css } from 'emotion';

const LegendItemStat: React.FunctionComponent<{ stat: StatDisplayValue }> = ({ stat }) => {
  return (
    <div
      className={css`
        margin-left: 6px;
      `}
    >
      {stat.text}
    </div>
  );
};

LegendItemStat.displayName = 'LegendItemStat';

export const LegendStatsList: React.FunctionComponent<{ stats: StatDisplayValue[] }> = ({ stats }) => {
  if (stats.length === 0) {
    return null;
  }
  return <InlineList items={stats} renderItem={stat => <LegendItemStat stat={stat} />} />;
};

LegendStatsList.displayName = 'LegendStatsList';
