import { CoreApp, LoadingState, QueryEditorProps, SelectableValue } from '@grafana/data';
import { EditorHeader, InlineSelect, FlexItem } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Badge, Button } from '@grafana/ui';

import { CloudWatchDatasource } from '../../datasource';
import { isCloudWatchLogsQuery, isCloudWatchMetricsQuery } from '../../guards';
import { useIsMonitoringAccount, useRegions } from '../../hooks';
import { CloudWatchJsonData, CloudWatchQuery, CloudWatchQueryMode } from '../../types';

export interface Props extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> {
  extraHeaderElementLeft?: JSX.Element;
  extraHeaderElementRight?: JSX.Element;
  dataIsStale: boolean;
}

const apiModes: Array<SelectableValue<CloudWatchQueryMode>> = [
  { label: 'CloudWatch Metrics', value: 'Metrics' },
  { label: 'CloudWatch Logs', value: 'Logs' },
];

const QueryHeader = ({
  query,
  onChange,
  datasource,
  extraHeaderElementLeft,
  extraHeaderElementRight,
  dataIsStale,
  data,
  onRunQuery,
}: Props) => {
  const { queryMode, region } = query;
  const isMonitoringAccount = useIsMonitoringAccount(datasource.resources, query.region);
  const [regions, regionIsLoading] = useRegions(datasource);
  const emptyLogsExpression = isCloudWatchLogsQuery(query) ? !query.expression : false;

  const onQueryModeChange = ({ value }: SelectableValue<CloudWatchQueryMode>) => {
    if (value && value !== queryMode) {
      onChange({
        ...datasource.getDefaultQuery(CoreApp.Unknown),
        ...query,
        queryMode: value,
        expression: '',
      });
    }
  };
  const onRegionChange = async (region: string) => {
    if (config.featureToggles.cloudWatchCrossAccountQuerying && isCloudWatchMetricsQuery(query)) {
      const isMonitoringAccount = await datasource.resources.isMonitoringAccount(region);
      onChange({ ...query, region, accountId: isMonitoringAccount ? query.accountId : undefined });
    } else {
      onChange({ ...query, region });
    }
  };

  const shouldDisplayMonitoringBadge = config.featureToggles.cloudWatchCrossAccountQuerying && isMonitoringAccount;

  return (
    <>
      <EditorHeader>
        <InlineSelect
          label="Region"
          value={region}
          placeholder="Select region"
          allowCustomValue
          onChange={({ value: region }) => region && onRegionChange(region)}
          options={regions}
          isLoading={regionIsLoading}
        />

        <InlineSelect
          aria-label="Query mode"
          value={queryMode}
          options={apiModes}
          onChange={onQueryModeChange}
          inputId={`cloudwatch-query-mode-${query.refId}`}
          id={`cloudwatch-query-mode-${query.refId}`}
        />

        {extraHeaderElementLeft}

        <FlexItem grow={1} />

        {shouldDisplayMonitoringBadge && (
          <>
            <Badge
              text="Monitoring account"
              color="blue"
              tooltip="AWS monitoring accounts view data from source accounts so you can centralize monitoring and troubleshoot activities"
            ></Badge>
          </>
        )}

        <Button
          variant={dataIsStale ? 'primary' : 'secondary'}
          size="sm"
          onClick={onRunQuery}
          icon={data?.state === LoadingState.Loading ? 'spinner' : undefined}
          disabled={data?.state === LoadingState.Loading || emptyLogsExpression}
        >
          Run queries
        </Button>

        {extraHeaderElementRight}
      </EditorHeader>
    </>
  );
};

export default QueryHeader;
