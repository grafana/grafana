import { css } from '@emotion/css';
import { useMemo } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { PanelData } from '@grafana/data/types';
import { useStyles2 } from '@grafana/ui/themes';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { type ExpressionQuery } from 'app/features/expressions/types';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { Expression } from '../expressions/Expression';

import { errorFromCurrentCondition, errorFromPreviewData, warningFromSeries } from './util';

interface Props {
  condition: string | null;
  onSetCondition: (refId: string) => void;
  panelData: Record<string, PanelData | undefined>;
  queries: AlertQuery[];
  onRemoveExpression: (refId: string) => void;
  onUpdateRefId: (oldRefId: string, newRefId: string) => void;
  onUpdateQueryExpression: (query: ExpressionQuery) => void;
}

export const ExpressionsEditor = ({
  condition,
  onSetCondition,
  queries,
  panelData,
  onUpdateRefId,
  onRemoveExpression,
  onUpdateQueryExpression,
}: Props) => {
  const expressionQueries = useMemo(() => {
    return queries.reduce((acc: ExpressionQuery[], query) => {
      if (isExpressionQuery(query.model)) {
        acc.push(query.model);
      }

      return acc;
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
