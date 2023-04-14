import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

export const hasCyclicalReferences = (queries: AlertQuery[]) => {
  try {
    JSON.stringify(queries);
    return false;
  } catch (e) {
    return true;
  }
};

export const findDataSourceFromExpressionRecursive = (
  queries: AlertQuery[],
  alertQuery: AlertQuery
): AlertQuery | null | undefined => {
  //Check if this is not cyclical structre
  if (hasCyclicalReferences(queries)) {
    return null;
  }
  // We have the data source in this dataQuery
  if (alertQuery.datasourceUid !== ExpressionDatasourceUID) {
    return alertQuery;
  }
  // alertQuery it's an expression, we have to traverse all the tree up to the data source
  else {
    const alertQueryReferenced = queries.find((alertQuery_) => alertQuery_.refId === alertQuery.model.expression);
    if (alertQueryReferenced) {
      return findDataSourceFromExpressionRecursive(queries, alertQueryReferenced);
    } else {
      return null;
    }
  }
};
