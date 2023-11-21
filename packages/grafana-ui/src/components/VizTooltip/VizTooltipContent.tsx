import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { VizTooltipRow } from './VizTooltipRow';
import { LabelValue } from './types';

interface Props {
  contentLabelValue: LabelValue[];
  customContent?: ReactElement | null;
}

export const VizTooltipContent = ({ contentLabelValue, customContent }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div>
        {contentLabelValue?.map((labelValue, i) => {
          const { label, value, color, colorIndicator } = labelValue;
          return (
            <VizTooltipRow
              key={i}
              label={label}
              value={value}
              color={color}
              colorIndicator={colorIndicator}
              colorFirst={false}
              justify={'space-between'}
            />
          );
        })}
      </div>
      {customContent && <div className={styles.customContentPadding}>{customContent}</div>}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    gap: 4,
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
  customContentPadding: css({
    padding: `${theme.spacing(1)} 0`,
  }),
});
