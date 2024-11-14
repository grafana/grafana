import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { QueryEditorExpressionType } from '../../expressions';
import { SQLQuery } from '../../types';
import { buildMockDB } from '../SqlComponents.testHelpers';

import { SelectRow } from './SelectRow';

// Mock featureToggle sqlQuerybuilderFunctionParameters
jest.mock('@grafana/runtime', () => ({
  config: {
    featureToggles: {
      sqlQuerybuilderFunctionParameters: true,
    },
  },
}));

describe('SelectRow', () => {
  const query = Object.freeze<SQLQuery>({
    refId: 'A',
    rawSql: '',
    sql: {
      columns: [
        {
          name: '$__timeGroup',
          parameters: [
            { name: 'createdAt', type: QueryEditorExpressionType.FunctionParameter },
            { name: '$__interval', type: QueryEditorExpressionType.FunctionParameter },
          ],
          alias: 'time',
          type: QueryEditorExpressionType.Function,
        },
      ],
    },
  });

  it('should show query passed as a prop', () => {
    const onQueryChange = jest.fn();
    render(<SelectRow onQueryChange={onQueryChange} query={query} columns={[]} db={buildMockDB()} />);

    expect(screen.getByTestId(selectors.components.SQLQueryEditor.selectAggregation)).toHaveTextContent('$__timeGroup');
    expect(screen.getByTestId(selectors.components.SQLQueryEditor.selectAlias)).toHaveTextContent('time');
    expect(screen.getByTestId(selectors.components.SQLQueryEditor.selectColumn)).toHaveTextContent('createdAt');
    expect(screen.getByTestId(selectors.components.SQLQueryEditor.selectInputParameter)).toHaveValue('$__interval');
  });

  describe('should handle multiple columns manipulations', () => {
    it('adding column', () => {
      const onQueryChange = jest.fn();
      render(<SelectRow onQueryChange={onQueryChange} query={query} columns={[]} db={buildMockDB()} />);
      screen.getByRole('button', { name: 'Add column' }).click();
      expect(onQueryChange).toHaveBeenCalledWith({
        ...query,
        sql: {
          columns: [
            ...query.sql?.columns!,
            {
              name: undefined,
              parameters: [],
              type: QueryEditorExpressionType.Function,
            },
          ],
        },
      });
    });

    it('show multiple columns when new column added', () => {
      const onQueryChange = jest.fn();
      render(
        <SelectRow
          columns={[]}
          onQueryChange={onQueryChange}
          db={buildMockDB()}
          query={{
            ...query,
            sql: {
              ...query.sql,

              columns: [
                ...query.sql?.columns!,
                { name: undefined, parameters: [], type: QueryEditorExpressionType.Function },
              ],
            },
          }}
        />
      );

      // Check the first column values
      expect(screen.getAllByTestId(selectors.components.SQLQueryEditor.selectAggregation)[0]).toHaveTextContent(
        '$__timeGroup'
      );
      expect(screen.getAllByTestId(selectors.components.SQLQueryEditor.selectAlias)[0]).toHaveTextContent('time');
      expect(screen.getAllByTestId(selectors.components.SQLQueryEditor.selectColumn)[0]).toHaveTextContent('createdAt');
      expect(screen.getAllByTestId(selectors.components.SQLQueryEditor.selectInputParameter)[0]).toHaveValue(
        '$__interval'
      );

      // Check the second column values
      expect(
        screen.getAllByTestId(selectors.components.SQLQueryEditor.selectAggregationInput)[1]
      ).toBeEmptyDOMElement();
      expect(screen.getAllByTestId(selectors.components.SQLQueryEditor.selectAliasInput)[1]).toBeEmptyDOMElement();
      expect(screen.getAllByTestId(selectors.components.SQLQueryEditor.selectColumnInput)[1]).toBeEmptyDOMElement();
      expect(screen.queryAllByTestId(selectors.components.SQLQueryEditor.selectInputParameter)[1]).toBeFalsy();
    });

    it('removing column', () => {
      const onQueryChange = jest.fn();
      render(
        <SelectRow
          columns={[]}
          db={buildMockDB()}
          onQueryChange={onQueryChange}
          query={{
            ...query,
            sql: {
              columns: [
                ...query.sql?.columns!,
                {
                  name: undefined,
                  parameters: [],
                  type: QueryEditorExpressionType.Function,
                },
              ],
            },
          }}
        />
      );
      screen.getAllByRole('button', { name: 'Remove column' })[1].click();
      expect(onQueryChange).toHaveBeenCalledWith(query);
    });

    it('modifying second column aggregation', async () => {
      const onQueryChange = jest.fn();
      const db = buildMockDB();
      db.functions = () => [{ name: 'AVG' }];
      const multipleColumns = Object.freeze<SQLQuery>({
        ...query,
        sql: {
          columns: [
            ...query.sql?.columns!,
            {
              name: '',
              parameters: [{ name: 'gaugeValue', type: QueryEditorExpressionType.FunctionParameter }],
              type: QueryEditorExpressionType.Function,
            },
          ],
        },
      });
      render(<SelectRow columns={[]} db={db} onQueryChange={onQueryChange} query={multipleColumns} />);
      await userEvent.click(screen.getAllByTestId(selectors.components.SQLQueryEditor.selectAggregation)[1]);
      await userEvent.click(screen.getByText('AVG'));

      expect(onQueryChange).toHaveBeenCalledWith({
        ...query,
        sql: {
          columns: [
            ...query.sql?.columns!,
            {
              name: 'AVG',
              parameters: [{ name: 'gaugeValue', type: QueryEditorExpressionType.FunctionParameter }],
              type: QueryEditorExpressionType.Function,
            },
          ],
        },
      });
    });

    it('modifying second column name with custom value', async () => {
      const onQueryChange = jest.fn();
      const db = buildMockDB();
      const multipleColumns = Object.freeze<SQLQuery>({
        ...query,
        sql: {
          columns: [
            ...query.sql?.columns!,
            {
              name: '',
              parameters: [{ name: undefined, type: QueryEditorExpressionType.FunctionParameter }],
              type: QueryEditorExpressionType.Function,
            },
          ],
        },
      });
      render(
        <SelectRow
          db={db}
          columns={[{ label: 'newColumn', value: 'newColumn' }]}
          onQueryChange={onQueryChange}
          query={multipleColumns}
        />
      );
      await userEvent.click(screen.getAllByTestId(selectors.components.SQLQueryEditor.selectColumn)[1]);
      await userEvent.type(
        screen.getAllByTestId(selectors.components.SQLQueryEditor.selectColumnInput)[1],
        'newColumn2{enter}'
      );

      expect(onQueryChange).toHaveBeenCalledWith({
        ...query,
        sql: {
          columns: [
            ...query.sql?.columns!,
            {
              name: '',
              parameters: [{ name: 'newColumn2', type: QueryEditorExpressionType.FunctionParameter }],
              type: QueryEditorExpressionType.Function,
            },
          ],
        },
      });
    });

    it('handles second parameter', async () => {
      const onQueryChange = jest.fn();
      const db = buildMockDB();
      const multipleColumns = Object.freeze<SQLQuery>({
        ...query,
        sql: {
          columns: [
            ...query.sql?.columns!,
            {
              name: '$__timeGroup',
              parameters: [{ name: 'gaugeValue', type: QueryEditorExpressionType.FunctionParameter }],
              type: QueryEditorExpressionType.Function,
            },
          ],
        },
      });
      render(
        <SelectRow
          db={db}
          columns={[{ label: 'gaugeValue', value: 'gaugeValue' }]}
          onQueryChange={onQueryChange}
          query={multipleColumns}
        />
      );

      await userEvent.click(screen.getAllByRole('button', { name: 'Add parameter' })[1]);

      expect(onQueryChange).toHaveBeenCalledWith({
        ...query,
        sql: {
          columns: [
            ...query.sql?.columns!,
            {
              name: '$__timeGroup',
              parameters: [
                { name: 'gaugeValue', type: QueryEditorExpressionType.FunctionParameter },
                { name: '', type: QueryEditorExpressionType.FunctionParameter },
              ],
              type: QueryEditorExpressionType.Function,
            },
          ],
        },
      });
    });

    it('handles second parameter removal', () => {
      const onQueryChange = jest.fn();
      const db = buildMockDB();
      render(
        <SelectRow
          onQueryChange={onQueryChange}
          db={db}
          columns={[]}
          query={{
            ...query,
            sql: {
              columns: [
                ...query.sql?.columns!,
                {
                  name: '$__timeGroup',
                  parameters: [
                    { name: 'gaugeValue', type: QueryEditorExpressionType.FunctionParameter },
                    { name: 'null', type: QueryEditorExpressionType.FunctionParameter },
                  ],
                  type: QueryEditorExpressionType.Function,
                },
              ],
            },
          }}
        />
      );

      screen.getAllByRole('button', { name: 'Remove parameter' })[1].click();

      expect(onQueryChange).toHaveBeenCalledWith({
        ...query,
        sql: {
          columns: [
            ...query.sql?.columns!,
            {
              name: '$__timeGroup',
              parameters: [{ name: 'gaugeValue', type: QueryEditorExpressionType.FunctionParameter }],
              type: QueryEditorExpressionType.Function,
            },
          ],
        },
      });
    });
  });
});
