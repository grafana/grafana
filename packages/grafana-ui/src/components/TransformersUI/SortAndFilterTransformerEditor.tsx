import React, { useMemo, useCallback } from 'react';
import { SortAndFilterFieldsTransformerOptions } from '@grafana/data/src/transformations/transformers/sortAndFilter';
import { TransformerUIRegistyItem, TransformerUIProps } from './types';
import { DataTransformerID, transformersRegistry, DataFrame } from '@grafana/data';
import { InlineList } from '../List/InlineList';
import { Input } from '../Forms/Input/Input';

interface SortAndFilterTransformerEditorProps extends TransformerUIProps<SortAndFilterFieldsTransformerOptions> {}

const SortAndFilterTransformerEditor: React.FC<SortAndFilterTransformerEditorProps> = props => {
  const { options, input, onChange } = props;
  const { indexByName, excludeByName } = options;

  const fields = useMemo(() => uniqueFieldNames(input, excludeByName), [input, excludeByName]);
  const sortedFields = useMemo(() => sortByIndex(fields, indexByName), [fields, indexByName]);

  const toggleExclude = useCallback(
    (field: string, shouldExclude: boolean) => {
      onChange({
        ...options,
        excludeByName: {
          ...excludeByName,
          [field]: shouldExclude,
        },
      });
    },
    [onChange, indexByName, excludeByName]
  );

  const changeSorting = useCallback(
    (field: string, value: string) => {
      onChange({
        ...options,
        indexByName: {
          ...indexByName,
          [field]: parseInt(value, 10),
        },
      });
    },
    [onChange, indexByName, excludeByName]
  );

  return (
    <InlineList
      items={sortedFields}
      renderItem={(fieldName, index) => {
        const excluded = excludeByName[fieldName];
        const icon = excluded ? 'fa fa-eye-slash' : 'fa fa-eye';

        return (
          <div>
            <i className={icon} onClick={() => toggleExclude(fieldName, !excluded)} />
            <span>&nbsp;{fieldName}</span>
            <Input
              defaultValue={index.toString()}
              onBlur={event => changeSorting(fieldName, event.currentTarget.value)}
            />
          </div>
        );
      }}
      getItemKey={fieldName => fieldName}
    />
  );
};

const sortByIndex = (fields: string[], indexByName: Record<string, number> = {}): string[] => {
  return fields.sort((a, b) => {
    const ai = indexByName[a] || 0;
    const bi = indexByName[b] || 0;

    return ai - bi;
  });
};

const uniqueFieldNames = (input: DataFrame[], excludeByName: Record<string, boolean>): string[] => {
  const fieldNames: Record<string, null> = {};

  input.reduce((names, frame) => {
    return frame.fields.reduce((names, field) => {
      names[field.name] = null;
      return names;
    }, names);
  }, fieldNames);

  // Object.keys(excludeByName).reduce((names, name) => {
  //   names[name] = null;
  //   return names;
  // }, fieldNames);

  return Object.keys(fieldNames);
};

export const sortAndFilterTransformRegistryItem: TransformerUIRegistyItem<SortAndFilterFieldsTransformerOptions> = {
  id: DataTransformerID.sortAndFilter,
  component: SortAndFilterTransformerEditor,
  transformer: transformersRegistry.get(DataTransformerID.sortAndFilter),
  name: 'Sort and filter',
  description: 'UI for sorting and hiding fields',
};
