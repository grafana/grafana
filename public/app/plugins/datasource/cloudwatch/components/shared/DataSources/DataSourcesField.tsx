import { Box, Stack } from '@grafana/ui';

import { type LogDataSource } from '../../../dataquery.gen';
import { type CloudWatchDatasource } from '../../../datasource';
import { type ListDataSourcesRequest } from '../../../resources/types';

import { DataSourcesSelector } from './DataSourcesSelector';
import { SelectedDataSources } from './SelectedDataSources';

type Props = {
  datasource: CloudWatchDatasource;
  dataSources?: LogDataSource[];
  onChange: (dataSources: LogDataSource[]) => void;
  region: string;
};

export const DataSourcesField = ({ datasource, dataSources, onChange, region }: Props) => {
  return (
    <Box marginTop={1} marginBottom={1}>
      <Stack direction="column" gap={1}>
        <DataSourcesSelector
          fetchDataSources={async (params: Partial<ListDataSourcesRequest>) =>
            datasource?.resources.getDataSources({ region: region, ...params }) ?? []
          }
          onChange={onChange}
          selectedDataSources={dataSources}
        />
        <SelectedDataSources selectedDataSources={dataSources ?? []} onChange={onChange} />
      </Stack>
    </Box>
  );
};
