import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React from 'react';

import { DisplayValue, formattedValueToString } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { InlineList } from '../List/InlineList';

interface Props {
  stats: DisplayValue[];
}

/**
 * @internal
 */
export const VizLegendStatsList = ({ stats }: Props) => {
  const styles = useStyles2(getStyles);

  if (stats.length === 0) {
    return null;
  }

  return (
    <InlineList
      className={styles.list}
      items={stats}
      renderItem={(stat) => (
        <div className={styles.item} title={stat.description}>
          {stat.title && `${capitalize(stat.title)}:`} {formattedValueToString(stat)}
        </div>
      )}
    />
  );
};

const getStyles = () => ({
  list: css`
    flex-grow: 1;
    text-align: right;
  `,
  item: css`
    margin-left: 8px;
  `,
});

VizLegendStatsList.displayName = 'VizLegendStatsList';
