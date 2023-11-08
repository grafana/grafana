import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { VizTooltipColorIndicator } from './VizTooltipColorIndicator';
import { LabelValue } from './types';

interface Props {
  keyValuePairs?: LabelValue[];
}

export const VizTooltipHeaderLabelValue = ({ keyValuePairs }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      {keyValuePairs?.map((keyValuePair, i) => (
        <div className={styles.contentWrapper} key={i}>
          <span className={styles.label}>{keyValuePair.label}</span>
          {keyValuePair.color && (
            <VizTooltipColorIndicator color={keyValuePair.color} colorIndicator={keyValuePair.colorIndicator!} />
          )}
          <span className={styles.value}>{keyValuePair.value}</span>
        </div>
      ))}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  hgContainer: css({
    flexGrow: 1,
  }),
  label: css({
    color: theme.colors.text.secondary,
    fontWeight: 400,
    marginRight: 'auto',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    minWidth: '48px',
  }),
  value: css({
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  contentWrapper: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
});
