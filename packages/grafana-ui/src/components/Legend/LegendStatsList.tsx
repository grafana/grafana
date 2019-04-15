import React from 'react';
import { InlineList } from '../List/InlineList';
import { css } from 'emotion';
import { DisplayValue } from '../../types/displayValue';
import capitalize from 'lodash/capitalize';

const LegendItemStat: React.FunctionComponent<{ stat: DisplayValue }> = ({ stat }) => {
  return (
    <div
      className={css`
        margin-left: 6px;
      `}
    >
      {stat.title && `${capitalize(stat.title)}:`} {stat.text}
    </div>
  );
};

LegendItemStat.displayName = 'LegendItemStat';

export const LegendStatsList: React.FunctionComponent<{ stats: DisplayValue[] }> = ({ stats }) => {
  if (stats.length === 0) {
    return null;
  }
  return <InlineList items={stats} renderItem={stat => <LegendItemStat stat={stat} />} />;
};

LegendStatsList.displayName = 'LegendStatsList';
