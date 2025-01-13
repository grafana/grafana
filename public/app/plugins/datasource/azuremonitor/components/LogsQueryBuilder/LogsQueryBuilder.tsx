import { useEffect, useState } from "react";

import { PanelData, TimeRange } from "@grafana/data";
import { EditorRows } from "@grafana/experimental";

import Datasource from "../../datasource";
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery } from "../../types";
import AdvancedResourcePicker from "../LogsQueryEditor/AdvancedResourcePicker";
import { LogsManagement } from "../LogsQueryEditor/LogsManagement";
import { shouldShowBasicLogsToggle } from "../LogsQueryEditor/utils";
import ResourceField from "../ResourceField/ResourceField";
import { ResourceRow, ResourceRowGroup, ResourceRowType } from "../ResourcePicker/types";
import { parseResourceDetails } from "../ResourcePicker/utils";


interface LogsQueryBuilderProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  basicLogsEnabled: boolean;
  subscriptionId?: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
  hideFormatAs?: boolean;
  timeRange?: TimeRange;
  data?: PanelData;
}

export const LogsQueryBuilder: React.FC<LogsQueryBuilderProps> = (props) => {
  const { basicLogsEnabled, subscriptionId, datasource, query, variableOptionGroup, setError, onChange } = props;
  const [showBasicLogsToggle, setShowBasicLogsToggle] = useState<boolean>(
      shouldShowBasicLogsToggle(query.azureLogAnalytics?.resources || [], basicLogsEnabled)
    );

  const disableRow = (row: ResourceRow, selectedRows: ResourceRowGroup) => {
    if (selectedRows.length === 0) {
      // Only if there is some resource(s) selected we should disable rows
      return false;
    }
    const rowResourceNS = parseResourceDetails(row.uri, row.location).metricNamespace?.toLowerCase();
    const selectedRowSampleNs = parseResourceDetails(
      selectedRows[0].uri,
      selectedRows[0].location
    ).metricNamespace?.toLowerCase();
    // Only resources with the same metricNamespace can be selected
    return rowResourceNS !== selectedRowSampleNs;
  };

  useEffect(() => {
      if (shouldShowBasicLogsToggle(query.azureLogAnalytics?.resources || [], basicLogsEnabled)) {
        setShowBasicLogsToggle(true);
      } else {
        setShowBasicLogsToggle(false);
      }
    }, [basicLogsEnabled, query.azureLogAnalytics?.resources]);

  return (
    <EditorRows>
      <ResourceField
        query={query}
        datasource={datasource}
        inlineField={true}
        labelWidth={10}
        subscriptionId={subscriptionId}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={setError}
        selectableEntryTypes={[
          ResourceRowType.Subscription,
          ResourceRowType.ResourceGroup,
          ResourceRowType.Resource,
          ResourceRowType.Variable,
        ]}
        resources={query.azureLogAnalytics?.resources ?? []}
        queryType="logs"
        disableRow={disableRow}
        renderAdvanced={(resources, onChange) => (
          // It's required to cast resources because the resource picker
          // specifies the type to string | AzureMonitorResource.
          // eslint-disable-next-line
          <AdvancedResourcePicker resources={resources as string[]} onChange={onChange} />
        )}
        selectionNotice={() => 'You may only choose items of the same resource type.'}
      />
      {showBasicLogsToggle && (
        <LogsManagement
          query={query}
          datasource={datasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
        />
      )}
      {/* <TableSection {...props} tableSchema={tableSchema} tables={tables} table={table} />
      <FilterSection {...props} columns={tableColumns} />
      <AggregateSection {...props} columns={tableColumns} />
      <GroupBySection {...props} columns={tableColumns} />
      <Timeshift {...props} />
      <KQLPreview query={props.query.query} /> */}
    </EditorRows>
  )
}
