import React, { useCallback } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  GroupingToMatrixTransformerOptions,
} from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { useAllFieldNamesFromDataFrames } from '../utils';

export const GroupingToMatrixTransformerEditor: React.FC<TransformerUIProps<GroupingToMatrixTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const fieldNames = useAllFieldNamesFromDataFrames(input).map((item: string) => ({ label: item, value: item }));

  const onSelectColumn = useCallback(
    (value: SelectableValue<string>) => {
      onChange({
        ...options,
        columnField: value.value,
      });
    },
    [onChange, options]
  );

  const onSelectRow = useCallback(
    (value: SelectableValue<string>) => {
      onChange({
        ...options,
        rowField: value.value,
      });
    },
    [onChange, options]
  );

  const onSelectValue = useCallback(
    (value: SelectableValue<string>) => {
      onChange({
        ...options,
        valueField: value.value,
      });
    },
    [onChange, options]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Column" labelWidth={8}>
          <Select options={fieldNames} value={options.columnField} onChange={onSelectColumn} isClearable />
        </InlineField>
        <InlineField label="Row" labelWidth={8}>
          <Select options={fieldNames} value={options.rowField} onChange={onSelectRow} isClearable />
        </InlineField>
        <InlineField label="Cell Value" labelWidth={10}>
          <Select options={fieldNames} value={options.valueField} onChange={onSelectValue} isClearable />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

export const groupingToMatrixTransformRegistryItem: TransformerRegistryItem<GroupingToMatrixTransformerOptions> = {
  id: DataTransformerID.groupingToMatrix,
  editor: GroupingToMatrixTransformerEditor,
  transformation: standardTransformers.groupingToMatrixTransformer,
  name: 'Grouping to matrix',
  description: `Takes a three fields combination and produces a Matrix`,
  help: `
Use this transformation to adapt your table visualization into a matrix using as rows and colums two specific fields and display a selected value.

**Options**:

- **Column:** Field to be used as the columns in the table
- **Row:** Field to be used as the rows in the table
- **Cell Value:** Field to be used as the value for the table cells

Consider the input:

| Server ID | Server Status | CPU Temperature (mean) |
| --------- | ------------- | ---------------------- |
| server 1  | Shutdown      | 82                     |
| server 2  | Shutdown      | 88.6                   |
| server 3  | Ok            | 59.6                   |

And the selected options as:

- **Column:** Server ID
- **Row:** Server Status
- **Cell Value:** CPU Temperature (mean)

it will produce a table in the shape of:

| Server Status\Server ID | server 1 | server 2 | server 3 |
| ----------------------- | -------- | -------- | -------- |
| Shutdown                | 82       | 88.6     |          |
| Ok                      |          |          | 59.6     |
`,
};
