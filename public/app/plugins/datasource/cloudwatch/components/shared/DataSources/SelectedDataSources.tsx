import { type LogDataSource } from '../../../dataquery.gen';
import { SelectionChipList } from '../SelectionChipList';

type Props = {
  selectedDataSources?: LogDataSource[];
  onChange: (selectedDataSources: LogDataSource[]) => void;
  maxNoOfVisibleDataSources?: number;
};

const MAX_NO_OF_VISIBLE_DATA_SOURCES = 6;

const toDataSourceKey = (dataSource: LogDataSource) => `${dataSource.name}.${dataSource.type}`;

export const SelectedDataSources = ({
  selectedDataSources = [],
  onChange,
  maxNoOfVisibleDataSources = MAX_NO_OF_VISIBLE_DATA_SOURCES,
}: Props) => {
  return (
    <SelectionChipList
      items={selectedDataSources}
      onChange={onChange}
      getKey={toDataSourceKey}
      getLabel={(dataSource) => `${dataSource.name}.${dataSource.type}`}
      maxVisibleItems={maxNoOfVisibleDataSources}
      clearTitle="Clear Data Source Selection"
      clearBody="Are you sure you want to clear all data sources?"
    />
  );
};
