import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { QueryEditorExpressionType } from '../../expressions';
import { QueryFormat, SQLExpression } from '../../types';

import { SelectRow } from './SelectRow';

describe('SelectRow', () => {
  const sql = Object.freeze<SQLExpression>({
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
  });

  it('should show query passed as a prop', () => {
    const onSqlChange = jest.fn();
    render(<SelectRow format={QueryFormat.Timeseries} onSqlChange={onSqlChange} sql={sql} />);

    expect(screen.getByTestId(selectors.components.SQLQueryEditor.selectAggregation)).toHaveTextContent('$__timeGroup');
    expect(screen.getByTestId(selectors.components.SQLQueryEditor.selectAlias)).toHaveTextContent('time');
    expect(screen.getByTestId(selectors.components.SQLQueryEditor.selectColumn)).toHaveTextContent('createdAt');
    expect(screen.getByTestId(selectors.components.SQLQueryEditor.selectInputParameter)).toHaveValue('$__interval');
  });

  describe('should handle multiple columns manipulations', () => {
    it('adding column', () => {
      const onSqlChange = jest.fn();
      render(<SelectRow format={QueryFormat.Timeseries} onSqlChange={onSqlChange} sql={sql} />);
      screen.getByRole('button', { name: 'Add' }).click();
      expect(onSqlChange).toHaveBeenCalledWith({
        columns: [
          sql.columns![0],
          {
            name: undefined,
            parameters: [],
            type: QueryEditorExpressionType.Function,
          },
        ],
      });
    });

    it('show multiple columns when new column added', () => {
      const onSqlChange = jest.fn();
      render(
        <SelectRow
          format={QueryFormat.Timeseries}
          onSqlChange={onSqlChange}
          sql={{
            ...sql,
            columns: [...sql.columns!, { name: undefined, parameters: [], type: QueryEditorExpressionType.Function }],
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
      const onSqlChange = jest.fn();
      render(
        <SelectRow
          format={QueryFormat.Timeseries}
          onSqlChange={onSqlChange}
          sql={{
            columns: [
              sql.columns![0],
              {
                name: undefined,
                parameters: [],
                type: QueryEditorExpressionType.Function,
              },
            ],
          }}
        />
      );
      screen.getAllByRole('button', { name: 'Remove' })[1].click();
      expect(onSqlChange).toHaveBeenCalledWith({
        columns: [sql.columns![0]],
      });
    });

    it('modifying second column aggregation', async () => {
      const onSqlChange = jest.fn();
      const multipleColumns = Object.freeze<SQLExpression>({
        columns: [
          sql.columns![0],
          {
            name: '',
            parameters: [{ name: 'gaugeValue', type: QueryEditorExpressionType.FunctionParameter }],
            type: QueryEditorExpressionType.Function,
          },
        ],
      });
      render(
        <SelectRow
          format={QueryFormat.Timeseries}
          functions={[{ label: 'AVG', value: 'AVG' }]}
          onSqlChange={onSqlChange}
          sql={multipleColumns}
        />
      );
      await userEvent.click(screen.getAllByTestId(selectors.components.SQLQueryEditor.selectAggregation)[1]);
      await userEvent.click(screen.getByText('AVG'));

      expect(onSqlChange).toHaveBeenCalledWith({
        columns: [
          sql.columns![0],
          {
            name: 'AVG',
            parameters: [{ name: 'gaugeValue', type: QueryEditorExpressionType.FunctionParameter }],
            type: QueryEditorExpressionType.Function,
          },
        ],
      });
    });

    it('modifying second column name with custom value', async () => {
      const onSqlChange = jest.fn();
      const multipleColumns = Object.freeze<SQLExpression>({
        columns: [
          sql.columns![0],
          {
            name: '',
            parameters: [{ name: undefined, type: QueryEditorExpressionType.FunctionParameter }],
            type: QueryEditorExpressionType.Function,
          },
        ],
      });
      render(
        <SelectRow
          format={QueryFormat.Timeseries}
          functions={[{ label: 'AVG', value: 'AVG' }]}
          columns={[{ label: 'newColumn', value: 'newColumn' }]}
          onSqlChange={onSqlChange}
          sql={multipleColumns}
        />
      );
      await userEvent.click(screen.getAllByTestId(selectors.components.SQLQueryEditor.selectColumn)[1]);
      await userEvent.type(
        screen.getAllByTestId(selectors.components.SQLQueryEditor.selectColumnInput)[1],
        'newColumn2{enter}'
      );

      expect(onSqlChange).toHaveBeenCalledWith({
        columns: [
          sql.columns![0],
          {
            name: '',
            parameters: [{ name: 'newColumn2', type: QueryEditorExpressionType.FunctionParameter }],
            type: QueryEditorExpressionType.Function,
          },
        ],
      });
    });

    it('handles second parameter', async () => {
      const onSqlChange = jest.fn();
      const multipleColumns = Object.freeze<SQLExpression>({
        columns: [
          sql.columns![0],
          {
            name: '$__timeGroup',
            parameters: [{ name: 'gaugeValue', type: QueryEditorExpressionType.FunctionParameter }],
            type: QueryEditorExpressionType.Function,
          },
        ],
      });
      render(
        <SelectRow
          format={QueryFormat.Timeseries}
          functions={[{ label: '$__timeGroup', value: '$__timeGroup' }]}
          columns={[{ label: 'gaugeValue', value: 'gaugeValue' }]}
          onSqlChange={onSqlChange}
          sql={multipleColumns}
        />
      );

      await userEvent.click(screen.getAllByRole('button', { name: 'Add parameter' })[1]);

      expect(onSqlChange).toHaveBeenCalledWith({
        columns: [
          sql.columns![0],
          {
            name: '$__timeGroup',
            parameters: [
              { name: 'gaugeValue', type: QueryEditorExpressionType.FunctionParameter },
              { name: '', type: QueryEditorExpressionType.FunctionParameter },
            ],
            type: QueryEditorExpressionType.Function,
          },
        ],
      });
    });

    it('handles second parameter removal', () => {
      const onSqlChange = jest.fn();
      render(
        <SelectRow
          format={QueryFormat.Timeseries}
          onSqlChange={onSqlChange}
          sql={{
            columns: [
              sql.columns![0],
              {
                name: '$__timeGroup',
                parameters: [
                  { name: 'gaugeValue', type: QueryEditorExpressionType.FunctionParameter },
                  { name: 'null', type: QueryEditorExpressionType.FunctionParameter },
                ],
                type: QueryEditorExpressionType.Function,
              },
            ],
          }}
        />
      );

      screen.getAllByRole('button', { name: 'Remove parameter' })[1].click();

      expect(onSqlChange).toHaveBeenCalledWith({
        columns: [
          sql.columns![0],
          {
            name: '$__timeGroup',
            parameters: [{ name: 'gaugeValue', type: QueryEditorExpressionType.FunctionParameter }],
            type: QueryEditorExpressionType.Function,
          },
        ],
      });
    });
  });
});
