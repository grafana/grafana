import { AzureMonitorQuery } from '../../types';

import { tableTags } from './consts';

const buildTracesQuery = (operationId: string): string => {
  const tables = Object.keys(tableTags).join(',');
  const tags = Object.values(tableTags).join(',');
  return `set truncationmaxrecords=10000;
    set truncationmaxsize=67108864;
    union isfuzzy=true ${tables}
    | where $__timeFilter()
    | where (operation_Id != '' and operation_Id == '${operationId}') or (customDimensions.ai_legacyRootId != '' and customDimensions.ai_legacyRootId == '${operationId}')
    | extend duration = iff(isnull(duration), toreal(0), duration)
    | extend spanID = iff(itemType == "pageView" or isempty(id), tostring(new_guid()), id)
    | extend serviceName = iff(isempty(name), column_ifexists("problemId", ""), name)
    | extend tags = bag_pack_columns(${tags})
    | project-rename traceID = operation_Id, parentSpanID = operation_ParentId, startTime = timestamp, serviceTags = customDimensions, operationName = operation_Name
		| project traceID, spanID, parentSpanID, duration, serviceName, operationName, startTime, serviceTags, tags, itemId, itemType
    | order by startTime asc`;
};

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
