import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { RadioButtonGroup, Label, useStyles2 } from '@grafana/ui';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

interface Props {
  className?: string;
  stateFilter?: GrafanaAlertState;
  onStateFilterChange: (value: GrafanaAlertState | undefined) => void;
  itemPerStateStats?: Record<string, number>;
}

export const AlertInstanceStateFilter = React.memo<Props>(
  ({ className, onStateFilterChange, stateFilter, itemPerStateStats }) => {
    const styles = useStyles2(getStyles);

    const stateOptions = Object.values(GrafanaAlertState).map((value) => ({
      label: value,
      value,
      component: () => {
        return itemPerStateStats ? <span className={styles.counter}>{itemPerStateStats[value]}</span> : null;
      },
    }));

    return (
      <div className={className}>
        <Label>State</Label>
        <RadioButtonGroup
          options={stateOptions}
          value={stateFilter}
          onChange={onStateFilterChange}
          onClick={(v) => {
            if (v === stateFilter) {
              onStateFilterChange(undefined);
            }
          }}
        />
      </div>
    );
  }
);

AlertInstanceStateFilter.displayName = 'AlertInstanceStateFilter';

function getStyles(theme: GrafanaTheme2) {
  return {
    counter: css`
      display: inline-block;
      color: ${theme.colors.text.maxContrast};
    `,
  };
}
