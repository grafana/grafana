import type { Argument, Expression, JSXElementChild } from '@swc/core';

import { extractDefaultValue, extractJSXTextContent, extractKey, qualify, shouldIgnore } from '../duplicate-key-check';

function stringLitArg(value: string): Argument {
  return {
    expression: { type: 'StringLiteral', value, raw: `"${value}"`, span: { start: 0, end: 0, ctxt: 0 } } as Expression,
  };
}

function objArg(propValue: string): Argument {
  return {
    expression: {
      type: 'ObjectExpression',
      properties: [
        {
          type: 'KeyValueProperty',
          key: { type: 'Identifier', value: 'defaultValue', optional: false, span: { start: 0, end: 0, ctxt: 0 } },
          value: {
            type: 'StringLiteral',
            value: propValue,
            raw: `"${propValue}"`,
            span: { start: 0, end: 0, ctxt: 0 },
          },
          span: { start: 0, end: 0, ctxt: 0 },
        },
      ],
      span: { start: 0, end: 0, ctxt: 0 },
    },
  } as unknown as Argument;
}

describe('extractKey', () => {
  it('returns value from StringLiteral argument', () => {
    expect(extractKey(stringLitArg('my.key'))).toBe('my.key');
  });

  it('returns null for dynamic (Identifier) argument', () => {
    const arg: Argument = {
      expression: {
        type: 'Identifier',
        value: 'someVar',
        optional: false,
        span: { start: 0, end: 0, ctxt: 0 },
      } as Expression,
    };
    expect(extractKey(arg)).toBeNull();
  });

  it('returns null when argument is missing', () => {
    expect(extractKey(null)).toBeNull();
  });
});

describe('extractDefaultValue', () => {
  it('returns value from string literal second arg', () => {
    expect(extractDefaultValue(stringLitArg('Default text'))).toBe('Default text');
  });

  it('returns value from options object defaultValue property', () => {
    expect(extractDefaultValue(objArg('Default text'))).toBe('Default text');
  });

  it('returns null when options object has no defaultValue property', () => {
    const arg = {
      expression: {
        type: 'ObjectExpression',
        properties: [
          {
            type: 'KeyValueProperty',
            key: { type: 'Identifier', value: 'count', optional: false, span: { start: 0, end: 0, ctxt: 0 } },
            value: { type: 'NumericLiteral', value: 1, span: { start: 0, end: 0, ctxt: 0 } },
            span: { start: 0, end: 0, ctxt: 0 },
          },
        ],
        span: { start: 0, end: 0, ctxt: 0 },
      },
    } as unknown as Argument;
    expect(extractDefaultValue(arg)).toBeNull();
  });

  it('returns null when argument is missing', () => {
    expect(extractDefaultValue(null)).toBeNull();
  });
});

describe('extractJSXTextContent', () => {
  it('returns trimmed text from JSXText children', () => {
    const children: JSXElementChild[] = [
      { type: 'JSXText', value: '  Welcome back  ', raw: '  Welcome back  ', span: { start: 0, end: 0, ctxt: 0 } },
    ];
    expect(extractJSXTextContent(children)).toBe('Welcome back');
  });

  it('concatenates JSXText nodes separated by non-string expressions', () => {
    const children: JSXElementChild[] = [
      { type: 'JSXText', value: 'Click ', raw: 'Click ', span: { start: 0, end: 0, ctxt: 0 } },
      {
        type: 'JSXExpressionContainer',
        expression: { type: 'JSXEmptyExpression', span: { start: 0, end: 0, ctxt: 0 } },
        span: { start: 0, end: 0, ctxt: 0 },
      },
      { type: 'JSXText', value: 'to continue', raw: 'to continue', span: { start: 0, end: 0, ctxt: 0 } },
    ];
    expect(extractJSXTextContent(children)).toBe('Click to continue');
  });

  it('includes string literal JSXExpressionContainer values inline', () => {
    const children: JSXElementChild[] = [
      {
        type: 'JSXExpressionContainer',
        expression: {
          type: 'StringLiteral',
          value: '{{annoName}}',
          raw: '"{{annoName}}"',
          span: { start: 0, end: 0, ctxt: 0 },
        },
        span: { start: 0, end: 0, ctxt: 0 },
      },
      { type: 'JSXText', value: ' (Built-in)', raw: ' (Built-in)', span: { start: 0, end: 0, ctxt: 0 } },
    ];
    expect(extractJSXTextContent(children)).toBe('{{annoName}} (Built-in)');
  });

  it('returns null when there are no JSXText or string literal expression children', () => {
    const children: JSXElementChild[] = [
      {
        type: 'JSXExpressionContainer',
        expression: { type: 'JSXEmptyExpression', span: { start: 0, end: 0, ctxt: 0 } },
        span: { start: 0, end: 0, ctxt: 0 },
      },
    ];
    expect(extractJSXTextContent(children)).toBeNull();
  });
});

describe('qualify', () => {
  it('prepends defaultNS when no separator present', () => {
    expect(qualify('my.key', ':', 'translation')).toBe('translation:my.key');
  });

  it('returns key as-is when separator already present', () => {
    expect(qualify('common:my.key', ':', 'translation')).toBe('common:my.key');
  });

  it('returns key as-is when nsSep is false', () => {
    expect(qualify('my.key', false, 'translation')).toBe('my.key');
  });

  it('returns key as-is when defNS is false', () => {
    expect(qualify('my.key', ':', false)).toBe('my.key');
  });
});

describe('shouldIgnore', () => {
  it('returns false when key is not in ignore list', () => {
    expect(shouldIgnore('translation:button.save', ['common:*'])).toBe(false);
  });

  it('matches exact key', () => {
    expect(shouldIgnore('translation:button.save', ['translation:button.save'])).toBe(true);
  });

  it('matches prefix glob', () => {
    expect(shouldIgnore('common:button.save', ['common:*'])).toBe(true);
  });

  it('returns false for non-matching prefix glob', () => {
    expect(shouldIgnore('translation:button.save', ['common:*'])).toBe(false);
  });
});
