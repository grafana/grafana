import { css } from '@emotion/css';
import { capitalize } from 'lodash';

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
  list: css({
    flexGrow: 1,
    textAlign: 'right',
  }),
  item: css({
    marginLeft: '8px',
  }),
});

VizLegendStatsList.displayName = 'VizLegendStatsList';
