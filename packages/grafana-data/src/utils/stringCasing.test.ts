import { capitalize, kebabCase, startCase, upperFirst } from './stringCasing';

describe('startCase', () => {
  it('converts simple words', () => {
    expect(startCase('tooltip')).toBe('Tooltip');
    expect(startCase('legend')).toBe('Legend');
    expect(startCase('viz')).toBe('Viz');
  });

  it('splits camelCase', () => {
    expect(startCase('hideTooltip')).toBe('Hide Tooltip');
    expect(startCase('myVariableName')).toBe('My Variable Name');
  });

  it('converts snake_case', () => {
    expect(startCase('hide_tooltip')).toBe('Hide Tooltip');
    expect(startCase('some_long_name')).toBe('Some Long Name');
  });

  it('converts kebab-case', () => {
    expect(startCase('hide-tooltip')).toBe('Hide Tooltip');
  });

  it('handles multiple spaces', () => {
    expect(startCase('  hello   world  ')).toBe('Hello World');
  });

  it('handles empty string', () => {
    expect(startCase('')).toBe('');
  });

  it('lowercases uppercase words', () => {
    expect(startCase('ABC')).toBe('Abc');
  });
});

describe('kebabCase', () => {
  it('converts spaced names', () => {
    expect(kebabCase('Sharilyn Markowitz')).toBe('sharilyn-markowitz');
    expect(kebabCase('Naomi Striplin')).toBe('naomi-striplin');
  });

  it('splits camelCase', () => {
    expect(kebabCase('hideTooltip')).toBe('hide-tooltip');
    expect(kebabCase('myVariableName')).toBe('my-variable-name');
  });

  it('handles special characters', () => {
    expect(kebabCase('hello@world!')).toBe('hello-world');
    expect(kebabCase('foo---bar')).toBe('foo-bar');
  });

  it('trims whitespace', () => {
    expect(kebabCase('  hello world  ')).toBe('hello-world');
  });

  it('handles empty string', () => {
    expect(kebabCase('')).toBe('');
  });

  it('handles single word', () => {
    expect(kebabCase('Tooltip')).toBe('tooltip');
  });
});

describe('upperFirst', () => {
  it('uppercases the first character', () => {
    expect(upperFirst('hello')).toBe('Hello');
  });

  it('leaves the rest of the string untouched', () => {
    expect(upperFirst('helloWorld')).toBe('HelloWorld');
  });

  it('handles empty string', () => {
    expect(upperFirst('')).toBe('');
  });
});

describe('capitalize', () => {
  it('uppercases the first character and lowercases the rest', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('HELLO')).toBe('Hello');
    expect(capitalize('helloWorld')).toBe('Helloworld');
  });

  it('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });
});
