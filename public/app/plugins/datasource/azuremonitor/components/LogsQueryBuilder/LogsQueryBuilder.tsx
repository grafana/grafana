import { useEffect, useState } from "react";

import { EditorRows } from "@grafana/experimental";

import { AzureLogAnalyticsMetadataTable, AzureMonitorQuery, EngineSchema } from "../../types";

import KQLPreview from "./KQLPreview";
import { TableSection } from "./TableSection";

interface LogsQueryBuilderProps {
  query: AzureMonitorQuery;
  basicLogsEnabled: boolean;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  schema: EngineSchema;
}

  export const sampleData: AzureLogAnalyticsMetadataTable[] = [
    {
      id: "1",
      name: "Perf",
      description: "Performance data for resources",
      timespanColumn: "TimeGenerated",
      columns: [
        { name: "TimeGenerated", type: "datetime", description: "The timestamp of the record" },
        { name: "CounterName", type: "string", description: "The name of the performance counter" },
        { name: "CounterValue", type: "real", description: "The value of the performance counter" },
      ],
      related: {
        categories: ["Performance"],
        solutions: ["AzureMonitor"],
        functions: ["calculatePerformance"],
      },
      isTroubleshootingAllowed: true,
      hasData: true,
    },
    {
      id: "2",
      name: "Heartbeat",
      description: "Heartbeat data for monitored computers",
      timespanColumn: "TimeGenerated",
      columns: [
        { name: "TimeGenerated", type: "datetime", description: "The timestamp of the record" },
        { name: "Computer", type: "string", description: "The name of the computer" },
        { name: "OSName", type: "string", description: "The operating system name" },
      ],
      related: {
        categories: ["Monitoring"],
        solutions: ["LogAnalytics"],
        functions: ["getHeartbeatDetails"],
      },
      isTroubleshootingAllowed: true,
      hasData: true,
    },
    {
      id: "3",
      name: "EmptyTable",
      description: "A table with no data",
      timespanColumn: "TimeGenerated",
      columns: [
        { name: "TimeGenerated", type: "datetime", description: "The timestamp of the record" },
        { name: "DummyColumn", type: "string", description: "A dummy column for testing" },
      ],
      related: {
        categories: ["Testing"],
        solutions: ["TestSolution"],
        functions: ["noFunction"],
      },
      isTroubleshootingAllowed: false,
      hasData: false,
    },
  ];

export const LogsQueryBuilder: React.FC<LogsQueryBuilderProps> = (props) => {
  const { query, onQueryChange, schema } = props;
  const [tables, setTables] = useState<AzureLogAnalyticsMetadataTable[]>([]);

  useEffect(() => {
    if (schema?.database) {
      setTables(schema.database.tables)
    }
  }, [setTables, schema?.database])

  // NOTE: use function to create query (same as ADX) in table section? or pass it up to here to build!!
  
  return (
    <EditorRows>
      <TableSection {...props} tables={sampleData} onChange={onQueryChange} />
      {/* <FilterSection {...props} columns={tableColumns} />
      <AggregateSection {...props} columns={tableColumns} />
      <GroupBySection {...props} columns={tableColumns} />
      <Timeshift {...props} /> */}
      <KQLPreview query={query.azureLogAnalytics?.query!} /> 
    </EditorRows>
  )
};
