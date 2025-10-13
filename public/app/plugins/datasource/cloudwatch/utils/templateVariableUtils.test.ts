import { CustomVariableModel } from '@grafana/data';

import { logGroupNamesVariable, setupMockedTemplateService, regionVariable } from '../__mocks__/CloudWatchDataSource';

import { interpolateStringArrayUsingSingleOrMultiValuedVariable } from './templateVariableUtils';

interface TestCase {
  name: string;
  variable: CustomVariableModel;
  expected: string[];
  key?: 'value' | 'text';
}

const suffix = 'suffix';

describe('templateVariableUtils', () => {
  const multiValuedRepresentedAsArray = {
    ...logGroupNamesVariable,
    current: {
      value: ['templatedGroup-arn-2'],
      text: ['templatedGroup-2'],
      selected: true,
    },
  };

  const multiValuedRepresentedAsString = {
    ...logGroupNamesVariable,
    current: {
      value: 'templatedGroup-arn-2',
      text: 'templatedGroup-2',
      selected: true,
    },
  };

  describe('interpolateStringArrayUsingSingleOrMultiValuedVariable', () => {
    const cases: TestCase[] = [
      {
        name: 'should expand multi-valued variable with two values and use the metric find values',
        variable: logGroupNamesVariable,
        expected: logGroupNamesVariable.current.value as string[],
      },
      {
        name: 'should expand multi-valued variable with two values and use the metric find texts',
        variable: logGroupNamesVariable,
        expected: logGroupNamesVariable.current.text as string[],
        key: 'text',
      },
      {
        name: 'should expand multi-valued variable with one selected value represented as array and use metric find values',
        variable: multiValuedRepresentedAsArray,
        expected: multiValuedRepresentedAsArray.current.value as string[],
      },
      {
        name: 'should expand multi-valued variable with one selected value represented as array and use metric find texts',
        variable: multiValuedRepresentedAsArray,
        expected: multiValuedRepresentedAsArray.current.text as string[],
        key: 'text',
      },
      {
        name: 'should expand multi-valued variable with one selected value represented as a string and use metric find value',
        variable: multiValuedRepresentedAsString,
        expected: [multiValuedRepresentedAsString.current.value as string],
      },
      {
        name: 'should expand multi-valued variable with one selected value represented as a string and use metric find text',
        variable: multiValuedRepresentedAsString,
        expected: [multiValuedRepresentedAsString.current.text as string],
        key: 'text',
      },
    ];

    test.each(cases)('$name', async ({ variable, expected, key }) => {
      const templateService = setupMockedTemplateService([variable]);
      const strings = ['$' + variable.name, 'log-group'];
      const result = interpolateStringArrayUsingSingleOrMultiValuedVariable(templateService, strings, {}, key);
      expect(result).toEqual([...expected, 'log-group']);
    });

    const casesWithMultipleVariablesInString: TestCase[] = [
      {
        name: 'string with multiple variables should expand multi-valued variable with two values and use the metric find values',
        variable: logGroupNamesVariable,
        expected: [`${regionVariable.current.text}-${[...logGroupNamesVariable.current.value].join('|')}-${suffix}`],
      },
      {
        name: 'string with multiple variables should expand multi-valued variable with two values and use the metric find texts',
        variable: logGroupNamesVariable,
        expected: [`${regionVariable.current.text}-${[...logGroupNamesVariable.current.text].join(' + ')}-${suffix}`],
        key: 'text',
      },
      {
        name: 'string with multiple variables should expand multi-valued variable with one selected value represented as array and use metric find values',
        variable: multiValuedRepresentedAsArray,
        expected: [`${regionVariable.current.text}-${multiValuedRepresentedAsArray.current.value}-${suffix}`],
      },
      {
        name: 'should expand multi-valued variable with one selected value represented as array and use metric find texts',
        variable: multiValuedRepresentedAsArray,
        expected: [`${regionVariable.current.text}-${multiValuedRepresentedAsArray.current.text}-${suffix}`],
        key: 'text',
      },
      {
        name: 'string with multiple variables should expand multi-valued variable with one selected value represented as a string and use metric find value',
        variable: multiValuedRepresentedAsString,
        expected: [`${regionVariable.current.text}-${multiValuedRepresentedAsString.current.value}-${suffix}`],
      },
      {
        name: 'string with multiple variables should expand multi-valued variable with one selected value represented as a string and use metric find text',
        variable: multiValuedRepresentedAsString,
        expected: [`${regionVariable.current.text}-${multiValuedRepresentedAsString.current.text}-${suffix}`],
        key: 'text',
      },
    ];

    test.each(casesWithMultipleVariablesInString)('$name', async ({ variable, expected, key }) => {
      const templateService = setupMockedTemplateService([regionVariable, variable]);
      const strings = [`$${regionVariable.name}-$${variable.name}-${suffix}`, 'log-group'];
      const result = interpolateStringArrayUsingSingleOrMultiValuedVariable(templateService, strings, {}, key);
      expect(result).toEqual([...expected, 'log-group']);
    });

    it('should expand single-valued variable', () => {
      const templateService = setupMockedTemplateService([regionVariable]);
      const strings = ['$' + regionVariable.name, 'us-east-2'];
      const result = interpolateStringArrayUsingSingleOrMultiValuedVariable(templateService, strings, {});
      expect(result).toEqual([regionVariable.current.value, 'us-east-2']);
    });
  });
});
