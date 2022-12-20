import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme } from '@grafana/data/src';
import { useStyles } from '@grafana/ui/src';

import { RawListValue } from './RawListItem';

const getStyles = (theme: GrafanaTheme) => {
  // Borrowed from the monaco styles
  const reddish = theme.isDark ? '#ce9178' : '#a31515';
  const greenish = theme.isDark ? '#73bf69' : '#56a64b';

  return {
    metricName: css`
      color: ${greenish};
    `,
    metricValue: css`
      color: ${reddish};
    `,
  };
};

const RawListItemAttributes = ({ value, index, length }: { value: RawListValue; index: number; length: number }) => {
  const styles = useStyles(getStyles);

  // From the beginning of the string to the start of the `=`
  const attributeName = value.key;

  // From after the `="` to before the last `"`
  const attributeValue = value.value;

  return (
    <span className={'list-item-attribute'} key={index}>
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
