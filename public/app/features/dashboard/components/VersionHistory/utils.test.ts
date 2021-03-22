import { getDiffText, getDiffOperationText } from './utils';

describe('getDiffOperationText', () => {
  const cases = [
    ['add', 'added'],
    ['remove', 'deleted'],
    ['replace', 'changed'],
    ['byDefault', 'changed'],
  ];

  test.each(cases)('it returns the correct verb for an operation', (operation, expected) => {
    expect(getDiffOperationText(operation)).toBe(expected);
  });
});

describe('getDiffText', () => {
  const addEmptyArray = [{ op: 'add', value: [], path: ['annotations', 'list'], startLineNumber: 24 }, 'added list'];
  const addArrayNumericProp = [
    {
      op: 'add',
      value: ['tag'],
      path: ['panels', '3'],
    },
    'added item 3',
  ];
  const addArrayProp = [
    {
      op: 'add',
      value: [{ name: 'dummy target 1' }, { name: 'dummy target 2' }],
      path: ['panels', '3', 'targets'],
    },
    'added 2 targets',
  ];
  const addValueNumericProp = [
    {
      op: 'add',
      value: 'foo',
      path: ['panels', '3'],
    },
    'added item 3',
  ];
  const addValueProp = [
    {
      op: 'add',
      value: 'foo',
      path: ['panels', '3', 'targets'],
    },
    'added targets',
  ];

  const removeEmptyArray = [
    { op: 'remove', originalValue: [], path: ['annotations', 'list'], startLineNumber: 24 },
    'deleted list',
  ];
  const removeArrayNumericProp = [
    {
      op: 'remove',
      originalValue: ['tag'],
      path: ['panels', '3'],
    },
    'deleted item 3',
  ];
  const removeArrayProp = [
    {
      op: 'remove',
      originalValue: [{ name: 'dummy target 1' }, { name: 'dummy target 2' }],
      path: ['panels', '3', 'targets'],
    },
    'deleted 2 targets',
  ];
  const removeValueNumericProp = [
    {
      op: 'remove',
      originalValue: 'foo',
      path: ['panels', '3'],
    },
    'deleted item 3',
  ];
  const removeValueProp = [
    {
      op: 'remove',
      originalValue: 'foo',
      path: ['panels', '3', 'targets'],
    },
    'deleted targets',
  ];
  const replaceValueNumericProp = [
    {
      op: 'replace',
      originalValue: 'foo',
      value: 'bar',
      path: ['panels', '3'],
    },
    'changed item 3',
  ];
  const replaceValueProp = [
    {
      op: 'replace',
      originalValue: 'foo',
      value: 'bar',
      path: ['panels', '3', 'targets'],
    },
    'changed targets',
  ];

  const cases = [
    addEmptyArray,
    addArrayNumericProp,
    addArrayProp,
    addValueNumericProp,
    addValueProp,
    removeEmptyArray,
    removeArrayNumericProp,
    removeArrayProp,
    removeValueNumericProp,
    removeValueProp,
    replaceValueNumericProp,
    replaceValueProp,
  ];

  test.each(cases)(
    'returns a semantic message based on the type of operation, the values and the location of the change',
    (operation, expected) => {
      expect(getDiffText(operation)).toBe(expected);
    }
  );
});
