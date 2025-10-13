import { SOURCE_MAP } from './AlertRuleTemplate.constants';
import { SourceDescription, Template, TemplateParamUnit } from './AlertRuleTemplate.types';
import { formatTemplate, formatTemplates, beautifyUnit, formatSource } from './AlertRuleTemplate.utils';

const moment = jest.requireActual('moment-timezone');
moment.tz.setDefault('UTC');

const testTemplate = {
  source: SourceDescription.BUILT_IN,
  summary: 'MySQL database down',
  created_at: '2020-11-25T16:53:39.366Z',
  yaml: 'yaml file content',
} as Template;

const expectedTemplate = {
  source: SourceDescription.BUILT_IN,
  summary: 'MySQL database down',
  created_at: '2020-11-25 16:53:39',
  yaml: 'yaml file content',
};

describe('AlertRuleTemplatesTable utils', () => {
  test('formatTemplate', () => {
    expect(formatTemplate(testTemplate)).toEqual(expectedTemplate);
  });

  test('formatTemplate', () => {
    expect(formatTemplates([testTemplate, testTemplate])).toEqual([expectedTemplate, expectedTemplate]);
  });

  test('formatTemplate with undefined creation date', () => {
    const testTemplate = {
      source: SourceDescription.BUILT_IN,
      summary: 'MySQL database down',
      yaml: 'yaml file content',
    } as Template;

    const expectedTemplate = {
      source: SourceDescription.BUILT_IN,
      summary: 'MySQL database down',
      yaml: 'yaml file content',
    };

    expect(formatTemplates([testTemplate, testTemplate])).toEqual([expectedTemplate, expectedTemplate]);
  });

  test('beautifyUnit', () => {
    expect(beautifyUnit(TemplateParamUnit.PERCENTAGE)).toBe('%');
    expect(beautifyUnit(TemplateParamUnit.SECONDS)).toBe('seconds');
  });

  test('formatSource', () => {
    expect(formatSource(SourceDescription.BUILT_IN)).toBe(SOURCE_MAP.TEMPLATE_SOURCE_BUILT_IN);
    expect(formatSource(SourceDescription.SAAS)).toBe(SOURCE_MAP.TEMPLATE_SOURCE_SAAS);
  });
});
