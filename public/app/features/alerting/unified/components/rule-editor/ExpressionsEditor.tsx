import React, { FC, useMemo } from 'react';

import { PanelData } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { Expression } from '../expressions/Expression';

import { errorFromSeries, warningFromSeries } from './util';

interface Props {
  condition: string | null;
  onSetCondition: (refId: string) => void;
  panelData: Record<string, PanelData | undefined>;
  queries: AlertQuery[];
  onRemoveExpression: (refId: string) => void;
  onUpdateRefId: (oldRefId: string, newRefId: string) => void;
  onUpdateExpressionType: (refId: string, type: ExpressionQueryType) => void;
  onUpdateQueryExpression: (query: ExpressionQuery) => void;
}

export const ExpressionsEditor: FC<Props> = ({
  condition,
  onSetCondition,
  queries,
  panelData,
  onUpdateRefId,
  onRemoveExpression,
  onUpdateExpressionType,
  onUpdateQueryExpression,
}) => {
  const expressionQueries = useMemo(() => {
    return queries.reduce((acc: ExpressionQuery[], query) => {
      return isExpressionQuery(query.model) ? acc.concat(query.model) : acc;
    }, []);
  }, [queries]);

  return (
    <Stack direction="row" alignItems="stretch">
      {expressionQueries.map((query) => {
        const data = panelData[query.refId];

        const isAlertCondition = condition === query.refId;
        const error = isAlertCondition && data ? errorFromSeries(data.series) : undefined;
        const warning = isAlertCondition && data ? warningFromSeries(data.series) : undefined;

        return (
          <Expression
            key={query.refId}
            isAlertCondition={isAlertCondition}
            data={data}
            error={error}
            warning={warning}
            queries={queries}
            query={query}
            onSetCondition={onSetCondition}
            onRemoveExpression={onRemoveExpression}
            onUpdateRefId={onUpdateRefId}
            onUpdateExpressionType={onUpdateExpressionType}
            onChangeQuery={onUpdateQueryExpression}
          />
        );
      })}
    </Stack>
  );
};
