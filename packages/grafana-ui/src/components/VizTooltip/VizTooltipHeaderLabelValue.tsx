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
          <div className={styles.label}>{keyValuePair.label}</div>
          <div className={styles.value}>
            {keyValuePair.color && (
              <VizTooltipColorIndicator color={keyValuePair.color} colorIndicator={keyValuePair.colorIndicator!} />
            )}
            {keyValuePair.value}
          </div>
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
    marginRight: theme.spacing(0.5),
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  }),
  value: css({
    display: 'flex',
    alignItems: 'center',
  }),
  contentWrapper: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
});
