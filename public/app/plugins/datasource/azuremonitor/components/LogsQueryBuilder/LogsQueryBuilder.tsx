import { useEffect, useState } from "react";

import { PanelData, TimeRange } from "@grafana/data";
import { EditorRows } from "@grafana/experimental";

import AzureLogAnalyticsDatasource from "../../azure_log_analytics/azure_log_analytics_datasource";
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery } from "../../types";
import { parseResourceURI } from "../ResourcePicker/utils";

import { TableSection } from "./TableSection";


interface LogsQueryBuilderProps {
  query: AzureMonitorQuery;
  datasource: AzureLogAnalyticsDatasource;
  basicLogsEnabled: boolean;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
  hideFormatAs?: boolean;
  timeRange?: TimeRange;
  data?: PanelData;
}

export const LogsQueryBuilder: React.FC<LogsQueryBuilderProps> = (props) => {
  const { datasource, query } = props;
  const [tables, setTables] = useState([]);

  const fetchTables = async () => {
    let resourceURI;
    if (query.azureLogAnalytics?.resources) {
      resourceURI = parseResourceURI(query.azureLogAnalytics.resources[0])
      await datasource.getTables(resourceURI.subscription!, resourceURI.resourceGroup!, resourceURI.resourceName!).then((result) => {
        setTables(result.tables);
      });
    }
  };

  useEffect(() => {
    if (tables.length === 0) {
      fetchTables();
    }
  });

  return (
    <EditorRows>
      <TableSection {...props} tables={tables} />
      {/* <FilterSection {...props} columns={tableColumns} />
      <AggregateSection {...props} columns={tableColumns} />
      <GroupBySection {...props} columns={tableColumns} />
      <Timeshift {...props} />
      <KQLPreview query={props.query.query} /> */}
    </EditorRows>
  )
};
