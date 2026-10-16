import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { QueryEditorExpressionType } from '../../expressions';
import { type SQLQuery, type SQLQueryBuilderDB } from '../../types';
import { buildMockDB } from '../SqlComponents.testHelpers';

import { SqlQueryBuilder } from './SqlQueryBuilder';
import { VisualEditor } from './VisualEditor';

const query: SQLQuery = {
  refId: 'A',
  dataset: 'analytics',
  table: 'events',
  sql: {
    columns: [
      {
        type: QueryEditorExpressionType.Function,
        parameters: [{ type: QueryEditorExpressionType.FunctionParameter, name: 'duration' }],
      },
    ],
    limit: 50,
  },
};

describe('SqlQueryBuilder', () => {
  it('generates SQL through a minimal adapter and preserves the rest of the query', async () => {
    const db: SQLQueryBuilderDB = {
      fields: jest.fn(async () => [{ value: 'duration', type: 'number' }]),
      functions: () => [{ name: 'AVG' }],
      toRawSql: jest.fn(() => 'SELECT AVG(duration) FROM analytics.events LIMIT 50'),
    };
    const onChange = jest.fn();
    render(
      <SqlQueryBuilder
        db={db}
        query={{ ...query, hide: true }}
        onChange={onChange}
        queryRowFilter={{ filter: false, group: false, order: false, preview: false }}
      />
    );

    await waitFor(() => expect(db.fields).toHaveBeenCalledWith(expect.objectContaining({ table: 'events' })));
    await userEvent.click(screen.getByTestId(selectors.components.SQLQueryEditor.selectAggregation));
    await userEvent.click(screen.getByText('AVG'));

    const sql = {
      columns: [
        {
          type: QueryEditorExpressionType.Function,
          name: 'AVG',
          parameters: [{ type: QueryEditorExpressionType.FunctionParameter, name: 'duration' }],
        },
      ],
      limit: 50,
    };
    expect(db.toRawSql).toHaveBeenCalledWith({ refId: 'A', dataset: 'analytics', table: 'events', sql });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        refId: 'A',
        dataset: 'analytics',
        table: 'events',
        hide: true,
        rawSql: 'SELECT AVG(duration) FROM analytics.events LIMIT 50',
        sql,
      })
    );
  });

  it('renders caller-owned validation without invoking the adapter validator', async () => {
    jest.useFakeTimers();
    try {
      const db = buildMockDB();
      render(
        <SqlQueryBuilder db={db} query={query} onChange={jest.fn()} queryRowFilter={{ preview: false }}>
          <div role="status">Validation needs the current interval.</div>
        </SqlQueryBuilder>
      );

      await act(() => jest.advanceTimersByTimeAsync(1500));

      expect(screen.getByRole('status')).toHaveTextContent('Validation needs the current interval.');
      expect(db.validateQuery).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('retains automatic validation for the existing integrated visual editor', async () => {
    jest.useFakeTimers();
    try {
      const db = buildMockDB();
      const onValidate = jest.fn();
      const populated = { ...query, rawSql: 'SELECT duration FROM events' };
      render(
        <VisualEditor
          db={db}
          query={populated}
          onChange={jest.fn()}
          onValidate={onValidate}
          queryRowFilter={{ filter: false, group: false, order: false, preview: false }}
        />
      );

      await act(() => jest.advanceTimersByTimeAsync(1000));

      expect(db.validateQuery).toHaveBeenCalledWith(populated, undefined);
      expect(onValidate).toHaveBeenCalledWith(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
