import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { RawListValue } from './RawListItem';

const getStyles = (theme: GrafanaTheme2) => {
  // Borrowed from the monaco styles
  const reddish = theme.isDark ? '#ce9178' : '#a31515';
  const greenish = theme.isDark ? '#73bf69' : '#56a64b';

  return {
    metricName: css({
      color: greenish,
    }),
    metricValue: css({
      color: reddish,
    }),
    expanded: css({
      display: 'block',
      textIndent: '1em',
    }),
  };
};

const RawListItemAttributes = ({
  value,
  index,
  length,
  isExpandedView,
}: {
  value: RawListValue;
  index: number;
  length: number;
  isExpandedView: boolean;
}) => {
  const styles = useStyles2(getStyles);

  // From the beginning of the string to the start of the `=`
  const attributeName = value.key;

  // From after the `="` to before the last `"`
  const attributeValue = value.value;

  return (
    <span className={isExpandedView ? styles.expanded : ''} key={index}>
      <span className={styles.metricName}>{attributeName}</span>
      <span>=</span>
      <span>&quot;</span>
      <span className={styles.metricValue}>{attributeValue}</span>
      <span>&quot;</span>
      {index < length - 1 && <span>, </span>}
    </span>
  );
};

export default RawListItemAttributes;
