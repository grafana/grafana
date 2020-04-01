import React, { useMemo, useCallback } from 'react';
import { SortAndFilterFieldsTransformerOptions } from '@grafana/data/src/transformations/transformers/sortAndFilter';
import { TransformerUIRegistyItem, TransformerUIProps } from './types';
import { DataTransformerID, transformersRegistry, DataFrame, stringToJsRegex } from '@grafana/data';
import { InlineList } from '../List/InlineList';
import { Input } from '../Forms/Input/Input';

interface SortAndFilterTransformerEditorProps extends TransformerUIProps<SortAndFilterFieldsTransformerOptions> {}

const SortAndFilterTransformerEditor: React.FC<SortAndFilterTransformerEditorProps> = props => {
  const { options, input, onChange } = props;
  const { indexByName, exclude } = options;
  console.log('exclude', exclude);

  const fields = useMemo(() => uniqueFieldNames(input), input);
  const sortedFields = useMemo(() => sortByIndex(fields, indexByName), [fields, indexByName]);
  const isExcluded = useMemo(() => matcherFor(exclude), [exclude]);

  const toggleExclude = useCallback(
    (field: string, shouldExclude: boolean) => {
      onChange({
        ...options,
        exclude: recreateRegexp(exclude, field, shouldExclude),
      });
    },
    [onChange, indexByName, exclude]
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
    [onChange, indexByName, exclude]
  );

  return (
    <InlineList
      items={sortedFields}
      renderItem={(field, index) => {
        const excluded = isExcluded(field);
        const icon = excluded ? 'fa fa-eye-slash' : 'fa fa-eye';

        return (
          <div>
            <i className={icon} onClick={() => toggleExclude(field, !excluded)} />
            <span>&nbsp;{field}</span>
            <Input defaultValue={index.toString()} onBlur={event => changeSorting(field, event.currentTarget.value)} />
          </div>
        );
      }}
      getItemKey={field => field}
    />
  );
};

const recreateRegexp = (exclude: string | undefined, field: string, shouldExclude: boolean): string => {
  const match = /\^\((.*)\)\$$/g.exec(exclude ?? '');

  if (!match || match.length === 0) {
    return shouldExclude ? `^(${field})$` : '';
  }

  const parts = match[1].split('|');
  const fields = [...parts, field]
    .filter(current => {
      if (field === current) {
        return shouldExclude;
      }
      return true;
    })
    .join('|');

  return fields.length === 0 ? '' : `^(${fields})$`;
};

const sortByIndex = (fields: string[], indexByName: Record<string, number> = {}): string[] => {
  return fields.sort((a, b) => {
    const ai = indexByName[a] || 0;
    const bi = indexByName[b] || 0;

    return ai - bi;
  });
};

const uniqueFieldNames = (input: DataFrame[]): string[] => {
  const fields: Record<string, null> = {};

  input.reduce((allFields, frame) => {
    return frame.fields.reduce((fields, field) => {
      fields[field.name] = null;
      return fields;
    }, allFields);
  }, fields);

  return Object.keys(fields);
};

const matcherFor = (exclude: string | undefined): ((name: string) => boolean) => {
  if (!exclude) {
    return () => false;
  }
  const regex = stringToJsRegex(exclude);
  return (field: string) => regex.test(field);
};

export const sortAndFilterTransformRegistryItem: TransformerUIRegistyItem<SortAndFilterFieldsTransformerOptions> = {
  id: DataTransformerID.sortAndFilter,
  component: SortAndFilterTransformerEditor,
  transformer: transformersRegistry.get(DataTransformerID.sortAndFilter),
  name: 'Sort and filter',
  description: 'UI for sorting and hiding fields',
};
