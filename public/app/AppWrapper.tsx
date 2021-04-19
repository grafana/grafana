import React from 'react';
import QueryField from './plugins/datasource/grafana-azure-monitor-datasource/components/LogsQueryEditor/QueryField';
import { AzureMonitorQuery } from './plugins/datasource/grafana-azure-monitor-datasource/types';

interface TestRootProps {}

const TestRoot: React.FC<TestRootProps> = () => {
  const query = {
    azureLogAnalytics: {
      query: `Perf
  | where CounterName == "% Processor Time"
  | where ObjectName == "Processor"
  | summarize avg(CounterValue) by bin(TimeGenerated, 1m), Computer`,
    },
  } as AzureMonitorQuery;

  return (
    <QueryField
      query={query}
      datasource={{} as any}
      subscriptionId={'subscriptionId'}
      variableOptionGroup={{} as any}
      onQueryChange={(newValue) => {
        console.log('onQueryChange', newValue);
      }}
      setError={(error) => {
        console.log('setError', error);
      }}
    />
  );
};

export default TestRoot;
