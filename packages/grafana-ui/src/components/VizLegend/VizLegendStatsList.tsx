import React from 'react';
import { InlineList } from '../List/InlineList';
import { css } from 'emotion';
import { DisplayValue, formattedValueToString } from '@grafana/data';
import capitalize from 'lodash/capitalize';

const VizLegendItemStat: React.FunctionComponent<{ stat: DisplayValue }> = ({ stat }) => {
  const styles = css`
    margin-left: 8px;
  `;

  return (
    <div className={styles}>
      {stat.title && `${capitalize(stat.title)}:`} {formattedValueToString(stat)}
    </div>
  );
};

VizLegendItemStat.displayName = 'VizLegendItemStat';

export const VizLegendStatsList: React.FunctionComponent<{ stats: DisplayValue[] }> = ({ stats }) => {
  if (stats.length === 0) {
    return null;
  }
  return <InlineList items={stats} renderItem={(stat) => <VizLegendItemStat stat={stat} />} />;
};

VizLegendStatsList.displayName = 'VizLegendStatsList';
