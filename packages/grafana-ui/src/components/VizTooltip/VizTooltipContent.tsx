import { css } from '@emotion/css';
import React, { CSSProperties, ReactElement } from 'react';

import { GrafanaTheme2, arrayUtils } from '@grafana/data';
import { SortOrder } from '@grafana/schema';

import { useStyles2 } from '../../themes';

import { VizTooltipRow } from './VizTooltipRow';
import { LabelValue } from './types';

interface Props {
  contentLabelValue: LabelValue[];
  customContent?: ReactElement[];
  scrollable?: boolean;
  isPinned: boolean;
  sortOrder?: SortOrder;
}

export const VizTooltipContent = ({
  contentLabelValue,
  customContent,
  isPinned,
  scrollable = false,
  sortOrder = SortOrder.None,
}: Props) => {
  const styles = useStyles2(getStyles);

  if (sortOrder !== SortOrder.None) {
    const sortFn = arrayUtils.sortValues(sortOrder);
    // mutates!
    contentLabelValue.sort((a, b) => sortFn(a.value, b.value));
  }

  const scrollableStyle: CSSProperties = scrollable
    ? {
        maxHeight: 400,
        overflowY: 'auto',
      }
    : {};

  return (
    <div className={styles.wrapper} style={scrollableStyle}>
      <div>
        {contentLabelValue.map((labelValue, i) => {
          const { label, value, color, colorIndicator, colorPlacement, isActive } = labelValue;
          return (
            <VizTooltipRow
              key={i}
              label={label}
              value={value}
              color={color}
              colorIndicator={colorIndicator}
              colorPlacement={colorPlacement}
              isActive={isActive}
              justify={'space-between'}
              isPinned={isPinned}
            />
          );
        })}
      </div>
      {customContent?.map((content, i) => {
        return (
          <div key={i} className={styles.customContentPadding}>
            {content}
          </div>
        );
      })}
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
