import { type LogGroup } from '../../../dataquery.gen';
import { SelectionChipList } from '../SelectionChipList';

type CrossAccountLogsQueryProps = {
  selectedLogGroups?: LogGroup[];
  onChange: (selectedLogGroups: LogGroup[]) => void;
  maxNoOfVisibleLogGroups?: number;
};

const MAX_NO_OF_VISIBLE_LOG_GROUPS = 6;

export const SelectedLogGroups = ({
  selectedLogGroups = [],
  onChange,
  maxNoOfVisibleLogGroups = MAX_NO_OF_VISIBLE_LOG_GROUPS,
}: CrossAccountLogsQueryProps) => {
  return (
    <SelectionChipList
      items={selectedLogGroups}
      onChange={onChange}
      getKey={(logGroup) => logGroup.arn}
      getLabel={(logGroup) => `${logGroup.name}${logGroup.accountLabel ? `(${logGroup.accountLabel})` : ''}`}
      maxVisibleItems={maxNoOfVisibleLogGroups}
      clearTitle="Clear Log Group Selection"
      clearBody="Are you sure you want to clear all log groups?"
    />
  );
};
