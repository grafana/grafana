import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { VizTooltipColorIndicator } from './VizTooltipColorIndicator';
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
          return (
            <div className={styles.contentWrapper} key={i}>
              <div className={styles.label}>{labelValue.label}</div>
              <div className={styles.valueWrapper}>
                {labelValue.color && (
                  <VizTooltipColorIndicator color={labelValue.color} colorIndicator={labelValue.colorIndicator!} />
                )}
                <div className={styles.value}>{labelValue.value}</div>
              </div>
            </div>
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
  contentWrapper: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  }),
  customContentPadding: css({
    padding: `${theme.spacing(1)} 0`,
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
    fontWeight: 500,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  valueWrapper: css({
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  }),
});
