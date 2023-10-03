import { SupportedTransformationType } from '@grafana/data';

import { CorrelationConfig } from '../types';

export interface FormDTO {
  sourceUID: string;
  targetUID: string;
  label: string;
  description: string;
  config: CorrelationConfig;
}

export type EditFormDTO = Omit<FormDTO, 'targetUID' | 'sourceUID'>;

export type TransformationDTO = {
  type: SupportedTransformationType;
  expression?: string;
  mapValue?: string;
};

interface SupportedTransformationTypeDetails {
  label: string;
  value: string;
  description?: string;
  showExpression: boolean;
  showMapValue: boolean;
  requireExpression?: boolean;
}

export function getSupportedTransTypeDetails(
  transType: SupportedTransformationType
): SupportedTransformationTypeDetails {
  switch (transType) {
    case SupportedTransformationType.Logfmt:
      return {
        label: 'Logfmt',
        value: SupportedTransformationType.Logfmt,
        description: 'Parse provided field with logfmt to get variables',
        showExpression: false,
        showMapValue: false,
      };
    case SupportedTransformationType.Regex:
      return {
        label: 'Regular expression',
        value: SupportedTransformationType.Regex,
        description:
          'Field will be parsed with regex. Use named capture groups to return multiple variables, or a single unnamed capture group to add variable to named map value.',
        showExpression: true,
        showMapValue: true,
        requireExpression: true,
      };
    default:
      return { label: transType, value: transType, showExpression: false, showMapValue: false };
  }
}

export const getTransformOptions = () => {
  return Object.values(SupportedTransformationType).map((transformationType) => {
    const transType = getSupportedTransTypeDetails(transformationType);
    return {
      label: transType.label,
      value: transType.value,
      description: transType.description,
    };
  });
};
