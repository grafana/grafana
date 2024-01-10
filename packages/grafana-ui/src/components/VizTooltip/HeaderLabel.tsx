import React from 'react';

import { VizTooltipRow } from './VizTooltipRow';
import { LabelValue } from './types';

interface Props {
  headerLabel: LabelValue;
  isPinned: boolean;
}

export const HeaderLabel = ({ headerLabel, isPinned }: Props) => {
  const { label, value, color, colorIndicator } = headerLabel;

  return (
    <VizTooltipRow
      label={label}
      value={value}
      color={color}
      colorIndicator={colorIndicator}
      marginRight={'22px'}
      isPinned={isPinned}
    />
  );
};
