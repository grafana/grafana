import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, PanelData } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { Expression } from '../expressions/Expression';

import { errorFromCurrentCondition, errorFromPreviewData, warningFromSeries } from './util';

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

export const ExpressionsEditor = ({
  condition,
  onSetCondition,
  queries,
  panelData,
  onUpdateRefId,
  onRemoveExpression,
  onUpdateExpressionType,
  onUpdateQueryExpression,
}: Props) => {
  const expressionQueries = useMemo(() => {
    return queries.reduce((acc: ExpressionQuery[], query) => {
      return isExpressionQuery(query.model) ? acc.concat(query.model) : acc;
    }, []);
  }, [queries]);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      {expressionQueries.map((query) => {
        const data = panelData[query.refId];

        const isAlertCondition = condition === query.refId;

        const errorFromCondition = data && isAlertCondition ? errorFromCurrentCondition(data) : undefined;
        const errorFromPreview = data ? errorFromPreviewData(data) : undefined;
        const error = errorFromPreview || errorFromCondition;

        const warning = data ? warningFromSeries(data.series) : undefined;

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
    </div>
  );
};
const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    gap: theme.spacing(2),
    alignContent: 'stretch',
    flexWrap: 'wrap',
  }),
});
