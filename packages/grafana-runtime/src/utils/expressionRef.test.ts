import { isExpressionReference } from './expressionRef';

describe('isExpressionReference', () => {
  test('check all possible expression references', () => {
    expect(isExpressionReference('__expr__')).toBeTruthy(); // New UID
    expect(isExpressionReference('-100')).toBeTruthy(); // Legacy UID
    expect(isExpressionReference('Expression')).toBeTruthy(); // Name
    expect(isExpressionReference({ type: '__expr__' })).toBeTruthy();
    expect(isExpressionReference({ type: '-100' })).toBeTruthy();
    expect(isExpressionReference(null)).toBeFalsy();
    expect(isExpressionReference(undefined)).toBeFalsy();
  });
});
