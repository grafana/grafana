import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { HorizontalGroup } from '..';
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
            <HorizontalGroup justify="space-between" spacing="lg" key={i}>
              <div className={styles.label}>{labelValue.label}</div>
              <div className={styles.value}>{labelValue.value}</div>
            </HorizontalGroup>
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
    padding: `${theme.spacing(1)} 0`,
  }),
  customContentPadding: css({
    padding: `${theme.spacing(1)} 0`,
  }),
  label: css({
    color: theme.colors.text.secondary,
    fontWeight: 400,
  }),
  value: css({
    fontWeight: 500,
  }),
});
