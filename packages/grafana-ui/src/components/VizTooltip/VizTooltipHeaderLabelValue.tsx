import React from 'react';

import { VizTooltipRow } from './VizTooltipRow';
import { LabelValue } from './types';

interface Props {
  keyValuePairs?: LabelValue[];
}

export const VizTooltipHeaderLabelValue = ({ keyValuePairs }: Props) => (
  <>
    {keyValuePairs?.map((keyValuePair, i) => (
      <VizTooltipRow
        key={i}
        label={keyValuePair.label}
        value={keyValuePair.value}
        color={keyValuePair.color}
        colorIndicator={keyValuePair.colorIndicator!}
        colorFirst={false}
        justify={'space-between'}
      />
    ))}
  </>
);
