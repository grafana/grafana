import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { HorizontalGroup } from '..';
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
      {keyValuePairs?.map((keyValuePair, i) => {
        return (
          <HorizontalGroup justify="space-between" spacing="md" className={styles.hgContainer} key={i}>
            <div className={styles.label}>{keyValuePair.label}</div>
            <>
              {keyValuePair.color && (
                <VizTooltipColorIndicator color={keyValuePair.color} colorIndicator={keyValuePair.colorIndicator!} />
              )}
              {keyValuePair.value}
            </>
          </HorizontalGroup>
        );
      })}
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
  }),
});
