import { formatTemplate, formatTemplates } from './AlertRuleTemplatesTable.utils';
import { Template } from './AlertRuleTemplatesTable.types';

const moment = jest.requireActual('moment-timezone');
moment.tz.setDefault('UTC');

const testTemplate = {
  source: 'BUILT_IN',
  summary: 'MySQL database down',
  created_at: '2020-11-25T16:53:39.366Z',
  yaml: 'yaml file content',
} as Template;

const expectedTemplate = {
  source: 'Built-in',
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
      source: 'BUILT_IN',
      summary: 'MySQL database down',
      yaml: 'yaml file content',
    } as Template;

    const expectedTemplate = {
      source: 'Built-in',
      summary: 'MySQL database down',
      yaml: 'yaml file content',
    };

    expect(formatTemplates([testTemplate, testTemplate])).toEqual([expectedTemplate, expectedTemplate]);
  });
});
