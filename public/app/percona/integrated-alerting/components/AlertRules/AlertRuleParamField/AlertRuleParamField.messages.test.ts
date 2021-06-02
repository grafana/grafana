import { Messages } from './AlertRuleParamField.messages';
import { TemplateParamUnit } from '../../AlertRuleTemplate/AlertRuleTemplate.types';

describe('AlertRuleParamField::Messages', () => {
  const { getFloatDescription } = Messages;
  test('getFloatDescription', () => {
    expect(getFloatDescription('threshold', 'a threshold', TemplateParamUnit.SECONDS)).toBe('');
    expect(
      getFloatDescription('threshold', 'a threshold', TemplateParamUnit.SECONDS, {
        hasDefault: false,
        hasMin: true,
        hasMax: true,
        min: 10,
        max: 20,
      })
    ).toBe('Threshold - a threshold (seconds, min: 10, max: 20)');
    expect(
      getFloatDescription('just some param', 'a param', TemplateParamUnit.PERCENTAGE, {
        hasDefault: false,
        hasMin: false,
        hasMax: true,
        min: 10,
        max: 20,
      })
    ).toBe('Just Some Param - a param (%, max: 20)');
    expect(
      getFloatDescription('threshold', 'a threshold', TemplateParamUnit.SECONDS, {
        hasDefault: false,
        hasMin: true,
        hasMax: false,
        min: 10,
        max: 20,
      })
    ).toBe('Threshold - a threshold (seconds, min: 10)');
    expect(
      getFloatDescription('threshold', 'a threshold', TemplateParamUnit.SECONDS, {
        hasDefault: false,
        hasMin: true,
        hasMax: true,
        max: 10,
      })
    ).toBe('Threshold - a threshold (seconds, min: 0, max: 10)');
    expect(
      getFloatDescription('threshold', 'a threshold', TemplateParamUnit.PERCENTAGE, {
        hasDefault: false,
        hasMin: false,
        hasMax: false,
      })
    ).toBe('Threshold - a threshold (%)');
  });
});
