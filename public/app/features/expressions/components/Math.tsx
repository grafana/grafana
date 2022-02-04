import { InlineField, TextArea } from '@grafana/ui';
import { css } from '@emotion/css';
import React, { ChangeEvent, FC } from 'react';
import { ExpressionQuery } from '../types';

interface Props {
  labelWidth: number;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

const mathPlaceholder =
  'Math operations on one more queries, you reference the query by ${refId} ie. $A, $B, $C etc\n' +
  'Example: $A + $B\n' +
  'Available functions: abs(), log(), is_number(), round(), ceil(), floor(), is_inf(), is_nan(), is_null(), ';

export const Math: FC<Props> = ({ labelWidth, onChange, query }) => {
  const onExpressionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...query, expression: event.target.value });
  };

  return (
    <InlineField
      label="Expression"
      labelWidth={labelWidth}
      className={css`
        align-items: baseline;
      `}
    >
      <TextArea value={query.expression} onChange={onExpressionChange} rows={4} placeholder={mathPlaceholder} />
    </InlineField>
  );
};
