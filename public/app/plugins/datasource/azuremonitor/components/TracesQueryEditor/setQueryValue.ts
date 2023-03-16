import { AzureMonitorQuery, ResultFormat } from '../../types';

const buildTracesQuery = (operationId: string): string =>
  `set truncationmaxrecords=10000;
    set truncationmaxsize=67108864;
    union isfuzzy=true traces, customEvents, pageViews, requests, dependencies, exceptions, availabilityResults
    | where $__timeFilter()
    | where (operation_Id != '' and operation_Id == '${operationId}') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == '${operationId}')
    | extend duration = iff(isnull(duration), toreal(0), duration)
    | extend spanID = iff(itemType == "pageView" or isempty(id), tostring(new_guid()), id)
    | extend serviceName = iff(isempty(name), column_ifexists("problemId", ""), name)
    | project operation_Id, operation_ParentId, itemType, spanID, duration, timestamp, serviceName, customDimensions
    | project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions`;

export function setKustoQuery(query: AzureMonitorQuery, operationId?: string): AzureMonitorQuery {
  let kustoQuery;
  if (operationId) {
    kustoQuery = buildTracesQuery(operationId);
  }
  return {
    ...query,
    azureLogAnalytics: {
      ...query.azureLogAnalytics,
      operationId,
      query: kustoQuery,
    },
  };
}
