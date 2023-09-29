import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { HorizontalGroup, useStyles2 } from '@grafana/ui';

import { LabelValue } from './tooltipUtils';

interface VizTooltipContentProps {
  contentLabelValue: LabelValue[];
  customContent?: ReactElement | null;
}
export const VizTooltipContent = ({ contentLabelValue, customContent }: VizTooltipContentProps) => {
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
  wrapper: css`
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 4px;
    border-top: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(1)} 0;
  `,
  customContentPadding: css`
    padding-top: ${theme.spacing(2)};
  `,
  label: css`
    color: ${theme.colors.text.secondary};
    font-weight: 400;
  `,
  value: css`
    font-weight: 500;
  `,
});
