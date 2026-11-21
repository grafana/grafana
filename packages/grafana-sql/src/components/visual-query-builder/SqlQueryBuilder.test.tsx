import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import { EditorMode } from '@grafana/plugin-ui';

import { QueryEditorExpressionType } from '../../expressions';
import { QueryFormat, type SQLQuery, type SQLQueryBuilderDB } from '../../types';
import { setPropertyField } from '../../utils/sql.utils';
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
  it.each([
    { name: 'omitted editor mode and format', editorState: {} },
    {
      name: 'host-owned editor mode and format',
      editorState: { editorMode: EditorMode.Code, format: QueryFormat.Timeseries },
    },
  ])('generates SQL while preserving $name', async ({ editorState }) => {
    const db: SQLQueryBuilderDB = {
      fields: jest.fn(async () => [{ value: 'duration', type: 'number' }]),
      functions: () => [{ name: 'AVG' }],
      toRawSql: jest.fn(() => 'SELECT AVG(duration) FROM analytics.events LIMIT 50'),
    };
    const onChange = jest.fn();
    const hostQuery = { ...query, hide: true, rawSql: 'SELECT duration FROM analytics.events', ...editorState };
    render(
      <SqlQueryBuilder
        db={db}
        query={hostQuery}
        onChange={onChange}
        queryRowFilter={{ filter: false, group: false, order: false, preview: false }}
      />
    );

    await waitFor(() => expect(db.fields).toHaveBeenCalledWith(hostQuery));
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
    expect(onChange).toHaveBeenCalledWith({
      ...hostQuery,
      rawSql: 'SELECT AVG(duration) FROM analytics.events LIMIT 50',
      sql,
    });
  });

  it('associates function parameter labels with distinct select and text inputs', async () => {
    const db: SQLQueryBuilderDB = {
      ...buildMockDB(),
      functions: () => [
        {
          name: 'CUSTOM',
          parameters: [
            { name: 'First column', required: true, options: async () => [{ label: 'duration', value: 'duration' }] },
            { name: 'Second column', required: true, options: async () => [{ label: 'duration', value: 'duration' }] },
            { name: 'Interval', required: true },
          ],
        },
      ],
    };
    render(
      <SqlQueryBuilder
        db={db}
        query={{
          ...query,
          sql: { columns: [{ type: QueryEditorExpressionType.Function, name: 'CUSTOM', parameters: [] }] },
        }}
        onChange={jest.fn()}
        queryRowFilter={{ filter: false, group: false, order: false, preview: false }}
      />
    );

    const first = await screen.findByRole('combobox', { name: 'First column' });
    const second = screen.getByRole('combobox', { name: 'Second column' });
    expect(first.id).not.toBe(second.id);
    expect(screen.getByRole('textbox', { name: 'Interval' })).toHaveValue('');
  });

  it('lets users choose sort direction through named radio controls', async () => {
    const onChange = jest.fn();
    render(
      <SqlQueryBuilder
        db={buildMockDB()}
        query={{ ...query, sql: { ...query.sql, orderBy: setPropertyField('duration'), orderByDirection: 'ASC' } }}
        onChange={onChange}
        queryRowFilter={{ filter: false, group: false, preview: false }}
      />
    );

    expect(screen.getByRole('radio', { name: 'Sort by ascending' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Sort by descending' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.objectContaining({ orderByDirection: 'DESC' }),
      })
    );
  });

  it('renders caller-owned validation without invoking the adapter validator', async () => {
    jest.useFakeTimers();
    try {
      const db = buildMockDB();
      render(
        <SqlQueryBuilder
          db={db}
          query={{ ...query, rawSql: 'SELECT duration FROM analytics.events' }}
          onChange={jest.fn()}
          queryRowFilter={{ preview: false }}
        >
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
