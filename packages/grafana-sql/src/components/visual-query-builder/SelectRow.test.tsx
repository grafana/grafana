import { render, screen } from '@testing-library/react';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { QueryEditorExpressionType } from '../../expressions';
import { QueryFormat, SQLExpression } from '../../types';

import { SelectRow } from './SelectRow';

describe('SelectRow', () => {
  const sql: SQLExpression = {
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
  };
  it('should show query passed as a prop', () => {
    const onSqlChange = jest.fn();
    render(<SelectRow format={QueryFormat.Timeseries} onSqlChange={onSqlChange} sql={sql} />);
    expect(screen.getByTestId(selectors.components.SQLQueryEditor.selectAggregation)).toHaveTextContent('$__timeGroup');
    expect(screen.getByTestId(selectors.components.SQLQueryEditor.selectAlias)).toHaveTextContent('time');
    expect(screen.getByTestId(selectors.components.SQLQueryEditor.selectColumn)).toHaveTextContent('createdAt');
    expect(screen.getByTestId(selectors.components.SQLQueryEditor.selectInputParameter)).toHaveValue('$__interval');
  });

  describe('should handle multiple columns manipulations', () => {
    it('adding column', () => {});
  });
});
