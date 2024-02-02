import React from 'react';

import { VizTooltipRow } from './VizTooltipRow';
import { LabelValue } from './types';

interface Props {
  keyValuePairs?: LabelValue[];
  isPinned: boolean;
}

export const VizTooltipHeaderLabelValue = ({ keyValuePairs, isPinned }: Props) => (
  <>
    {keyValuePairs?.map((keyValuePair, i) => (
      <VizTooltipRow
        key={i}
        label={keyValuePair.label}
        value={keyValuePair.value}
        color={keyValuePair.color}
        colorIndicator={keyValuePair.colorIndicator!}
        justify={'space-between'}
        isPinned={isPinned}
      />
    ))}
  </>
);
