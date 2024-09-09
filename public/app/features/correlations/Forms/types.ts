import { SupportedTransformationType } from '@grafana/data';
import { t } from 'app/core/internationalization';

import { CorrelationConfig, CorrelationType } from '../types';

export interface FormDTO {
  sourceUID: string;
  targetUID: string;
  label: string;
  description: string;
  type: CorrelationType;
  config: CorrelationConfig;
}

export type EditFormDTO = Omit<FormDTO, 'targetUID' | 'sourceUID'>;

export type TransformationDTO = {
  type: SupportedTransformationType;
  expression?: string;
  mapValue?: string;
};

export interface TransformationFieldDetails {
  show: boolean;
  required?: boolean;
  helpText?: string;
}

interface SupportedTransformationTypeDetails {
  label: string;
  value: SupportedTransformationType;
  description?: string;
  expressionDetails: TransformationFieldDetails;
  mapValueDetails: TransformationFieldDetails;
}

export function getSupportedTransTypeDetails(
  transType: SupportedTransformationType
): SupportedTransformationTypeDetails {
  switch (transType) {
    case SupportedTransformationType.Logfmt:
      return {
        label: t('correlations.trans-details.logfmt-label', 'Logfmt'),
        value: SupportedTransformationType.Logfmt,
        description: t(
          'correlations.trans-details.logfmt-description',
          'Parse provided field with logfmt to get variables'
        ),
        expressionDetails: { show: false },
        mapValueDetails: { show: false },
      };
    case SupportedTransformationType.Regex:
      return {
        label: t('correlations.trans-details.regex-label', 'Regular expression'),
        value: SupportedTransformationType.Regex,
        description: t(
          'correlations.trans-details.regex-description',
          'Field will be parsed with regex. Use named capture groups to return multiple variables, or a single unnamed capture group to add variable to named map value. Regex is case insensitive.'
        ),
        expressionDetails: {
          show: true,
          required: true,
          helpText: t(
            'correlations.trans-details.regex-expression',
            'Use capture groups to extract a portion of the field.'
          ),
        },
        mapValueDetails: {
          show: true,
          required: false,
          helpText: t(
            'correlations.trans-details.regex-map-values',
            'Defines the name of the variable if the capture group is not named.'
          ),
        },
      };
    default:
      return {
        label: transType,
        value: transType,
        expressionDetails: { show: false },
        mapValueDetails: { show: false },
      };
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
