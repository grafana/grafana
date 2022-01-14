import { TemplateFloatParam, TemplateParamUnit } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { beautifyUnit } from '../../AlertRuleTemplate/AlertRuleTemplate.utils';

export const Messages = {
  getFloatDescription: (name: string, summary: string, unit: TemplateParamUnit, float?: TemplateFloatParam) => {
    if (!float) {
      return '';
    }

    const lowerCaseNameSentenceArr = name.toLowerCase().split(' ');
    const capitalizedSentence = lowerCaseNameSentenceArr
      .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
      .join(' ');
    const { hasMin, hasMax, min = 0, max = 0 } = float;
    const paramDetails: string[] = [beautifyUnit(unit)];

    if (hasMin) {
      paramDetails.push(`min: ${min}`);
    }

    if (hasMax) {
      paramDetails.push(`max: ${max}`);
    }

    return `${capitalizedSentence} - ${summary} (${paramDetails.join(', ')})`;
  },
};
