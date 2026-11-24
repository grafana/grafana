import { lazy, Suspense } from 'react';

import { type DataSourceApi, type QueryEditorProps } from '@grafana/data';

import { ClassicConditions } from './components/ClassicConditions';
import { Math } from './components/Math';
import { Reduce } from './components/Reduce';
import { Resample } from './components/Resample';
import { Threshold } from './components/Threshold';
import { type ExpressionQuery, ExpressionQueryType } from './types';

export type ExpressionQueryEditorProps = QueryEditorProps<DataSourceApi<ExpressionQuery>, ExpressionQuery>;

const labelWidth = 15;
const SqlExpr = lazy(() =>
  import('./components/SqlExpressions/SqlExpr').then((module) => ({
    default: module.SqlExpr,
  }))
);

export function ExpressionQueryEditor(props: ExpressionQueryEditorProps) {
  const { query, queries, onRunQuery, onChange, app } = props;

  const renderExpressionType = () => {
    const refIds = queries!.filter((q) => query.refId !== q.refId).map((q) => ({ value: q.refId, label: q.refId }));

    switch (query.type) {
      case ExpressionQueryType.math:
        return <Math onChange={onChange} query={query} labelWidth={labelWidth} onRunQuery={onRunQuery} />;

      case ExpressionQueryType.reduce:
        return <Reduce refIds={refIds} onChange={onChange} labelWidth={labelWidth} query={query} app={app} />;

      case ExpressionQueryType.resample:
        return <Resample query={query} labelWidth={labelWidth} onChange={onChange} refIds={refIds} />;

      case ExpressionQueryType.classic:
        return <ClassicConditions onChange={onChange} query={query} refIds={refIds} />;

      case ExpressionQueryType.threshold:
        return <Threshold onChange={onChange} query={query} labelWidth={labelWidth} refIds={refIds} />;

      case ExpressionQueryType.sql:
        return (
          <Suspense fallback={null}>
            <SqlExpr
              onChange={onChange}
              query={query}
              refIds={refIds}
              queries={queries}
              metadata={props}
              onRunQuery={onRunQuery}
            />
          </Suspense>
        );
    }
  };

  return <div>{renderExpressionType()}</div>;
}
