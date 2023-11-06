import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

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
              <div className={styles.value}>{labelValue.value}</div>
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
    justifyContent: 'space-between',
  }),
  customContentPadding: css({
    padding: `${theme.spacing(1)} 0`,
  }),
  label: css({
    color: theme.colors.text.secondary,
    fontWeight: 400,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  value: css({
    fontWeight: 500,
  }),
});
