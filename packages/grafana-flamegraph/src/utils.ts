import { type ChatContextItem } from '@grafana/assistant';
import { type DataFrame, formattedValueToString } from '@grafana/data';

import {
  type ProfileTooltipData,
  type ProfileTooltipDataOptions,
  type ProfileValueData,
  type ProfileValueDataOptions,
} from './types';

export function getAssistantContextFromDataFrame(data: DataFrame): ChatContextItem[] {
  return data.meta?.custom?.assistantContext || [];
}

interface ProfilePercentageOptions {
  value: number;
  total: number;
}

export function getProfilePercentage({ value, total }: ProfilePercentageOptions): number {
  if (total <= 0) {
    return 0;
  }

  return Math.round(10000 * (value / total)) / 100;
}

export function getProfileTooltipData({
  displayValue,
  displaySelf,
  unitTitle,
  totalTicks,
}: ProfileTooltipDataOptions): ProfileTooltipData {
  const value = getProfileValueData({ displayValue, totalTicks });
  const self = getProfileValueData({ displayValue: displaySelf, totalTicks });

  return {
    percentValue: value.percentage,
    percentSelf: self.percentage,
    unitTitle,
    unitValue: value.unitValue,
    unitSelf: self.unitValue,
    samples: displayValue.numeric.toLocaleString(),
  };
}

export function getProfileValueData({ displayValue, totalTicks }: ProfileValueDataOptions): ProfileValueData {
  return {
    unitValue: formattedValueToString(displayValue),
    percentage: getProfilePercentage({ value: displayValue.numeric, total: totalTicks }),
  };
}
