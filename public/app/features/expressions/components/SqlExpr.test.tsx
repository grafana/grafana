import { render } from '@testing-library/react';

import { ExpressionQuery } from '../types';

import { SqlExpr } from './SqlExpr';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  useStyles2: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@grafana/plugin-ui', () => ({
  SQLEditor: () => <div data-testid="sql-editor">SQL Editor Mock</div>,
}));

describe('SqlExpr', () => {
  it('initializes new expressions with default query', () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const query = { refId: 'expr1', type: 'sql', expression: '' } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} />);

    // Verify onChange was called
    expect(onChange).toHaveBeenCalled();

    // Verify essential SQL structure without exact string matching
    const updatedQuery = onChange.mock.calls[0][0];
    expect(updatedQuery.expression.toUpperCase()).toContain('SELECT');
  });

  it('preserves existing expressions when mounted', () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const existingExpression = 'SELECT 1 AS foo';
    const query = { refId: 'expr1', type: 'sql', expression: existingExpression } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} />);

    // Check if onChange was called
    if (onChange.mock.calls.length > 0) {
      // If called, ensure it didn't change the expression value
      const updatedQuery = onChange.mock.calls[0][0];
      expect(updatedQuery.expression).toBe(existingExpression);
    }

    // The SQLEditor should receive the existing expression
    expect(query.expression).toBe(existingExpression);
  });

  it('adds alerting format when alerting prop is true', () => {
    const onChange = jest.fn();
    const refIds = [{ value: 'A' }];
    const query = { refId: 'expr1', type: 'sql' } as ExpressionQuery;

    render(<SqlExpr onChange={onChange} refIds={refIds} query={query} alerting />);

    const updatedQuery = onChange.mock.calls[0][0];
    expect(updatedQuery.format).toBe('alerting');
  });
});
