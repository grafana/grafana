import { css } from '@emotion/css';
import { capitalize } from 'lodash';

import { type DisplayValue, formattedValueToString } from '@grafana/data';
import { t } from '@grafana/i18n';

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
          {stat.title && `${getLocalizedStatTitle(stat.title)}:`} {formattedValueToString(stat)}
        </div>
      )}
    />
  );
};

const getLocalizedStatTitle = (title: string) => {
  if (title.toLowerCase() === 'mean') {
    return t('grafana-data.field-reducers.mean.name', 'Mean');
  }

  return capitalize(title);
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
