import { cloneDeep } from 'lodash';
import { useMemo, useCallback } from 'react';

import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  getFieldDisplayName,
  DataFrame,
  SelectableValue,
  FieldType,
  ValueMatcherID,
  valueMatchers,
  TransformerCategory,
} from '@grafana/data';
import {
  FilterByValueFilter,
  FilterByValueMatch,
  FilterByValueTransformerOptions,
  FilterByValueType,
} from '@grafana/data/internal';
import { Trans, t } from '@grafana/i18n';
import { Button, RadioButtonGroup, InlineField, Box } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/filterByValue.svg';
import lightImage from '../images/light/filterByValue.svg';

import { DataFrameFieldsInfo, FilterByValueFilterEditor } from './FilterByValueFilterEditor';

export const FilterByValueTransformerEditor = (props: TransformerUIProps<FilterByValueTransformerOptions>) => {
  const { input, options, onChange } = props;
  const fieldsInfo = useFieldsInfo(input);

  const filterTypes: Array<SelectableValue<FilterByValueType>> = [
    {
      label: t('transformers.filter-by-value-transformer-editor.filter-types.label.include', 'Include'),
      value: FilterByValueType.include,
    },
    {
      label: t('transformers.filter-by-value-transformer-editor.filter-types.label.exclude', 'Exclude'),
      value: FilterByValueType.exclude,
    },
  ];

  const filterMatch: Array<SelectableValue<FilterByValueMatch>> = [
    {
      label: t('transformers.filter-by-value-transformer-editor.filter-match.label.match-all', 'Match all'),
      value: FilterByValueMatch.all,
    },
    {
      label: t('transformers.filter-by-value-transformer-editor.filter-match.label.match-any', 'Match any'),
      value: FilterByValueMatch.any,
    },
  ];

  const onAddFilter = useCallback(() => {
    const frame = input[0];
    const field = frame.fields.find((f) => f.type !== FieldType.time);

    if (!field) {
      return;
    }

    const filters = cloneDeep(options.filters);
    const matcher = valueMatchers.get(ValueMatcherID.isNull);

    filters.push({
      fieldName: getFieldDisplayName(field, frame, input),
      config: {
        id: matcher.id,
        options: matcher.getDefaultOptions(field),
      },
    });
    onChange({ ...options, filters });
  }, [onChange, options, input]);

  const onDeleteFilter = useCallback(
    (index: number) => {
      let filters = cloneDeep(options.filters);
      filters.splice(index, 1);
      onChange({ ...options, filters });
    },
    [options, onChange]
  );

  const onChangeFilter = useCallback(
    (filter: FilterByValueFilter, index: number) => {
      let filters = cloneDeep(options.filters);
      filters[index] = filter;
      onChange({ ...options, filters });
    },
    [options, onChange]
  );

  const onChangeType = useCallback(
    (type?: FilterByValueType) => {
      onChange({
        ...options,
        type: type ?? FilterByValueType.include,
      });
    },
    [options, onChange]
  );

  const onChangeMatch = useCallback(
    (match?: FilterByValueMatch) => {
      onChange({
        ...options,
        match: match ?? FilterByValueMatch.all,
      });
    },
    [options, onChange]
  );

  return (
    <div>
      <InlineField
        label={t('transformers.filter-by-value-transformer-editor.label-filter-type', 'Filter type')}
        labelWidth={16}
      >
        <div className="width-15">
          <RadioButtonGroup options={filterTypes} value={options.type} onChange={onChangeType} fullWidth />
        </div>
      </InlineField>
      {options.filters.length > 1 && (
        <InlineField
          label={t('transformers.filter-by-value-transformer-editor.label-conditions', 'Conditions')}
          labelWidth={16}
        >
          <div className="width-15">
            <RadioButtonGroup options={filterMatch} value={options.match} onChange={onChangeMatch} fullWidth />
          </div>
        </InlineField>
      )}
      <Box paddingLeft={2}>
        {options.filters.map((filter, idx) => (
          <FilterByValueFilterEditor
            key={idx}
            filter={filter}
            fieldsInfo={fieldsInfo}
            onChange={(filter) => onChangeFilter(filter, idx)}
            onDelete={() => onDeleteFilter(idx)}
          />
        ))}
        <Button icon="plus" size="sm" onClick={onAddFilter} variant="secondary">
          <Trans i18nKey="transformers.filter-by-value-transformer-editor.add-condition">Add condition</Trans>
        </Button>
      </Box>
    </div>
  );
};

export const getFilterByValueTransformRegistryItem: () => TransformerRegistryItem<FilterByValueTransformerOptions> =
  () => ({
    id: DataTransformerID.filterByValue,
    editor: FilterByValueTransformerEditor,
    transformation: standardTransformers.filterByValueTransformer,
    name: t('transformers.filter-by-value-transformer-editor.name.filter-data-by-values', 'Filter data by values'),
    description: t(
      'transformers.filter-by-value-transformer-editor.description.remove-rows-query-results-user-defined-filters',
      'Remove rows from the query results using user-defined filters.'
    ),
    categories: new Set([TransformerCategory.Filter]),
    help: getTransformationContent(DataTransformerID.filterByValue).helperDocs,
    imageDark: darkImage,
    imageLight: lightImage,
  });

const useFieldsInfo = (data: DataFrame[]): DataFrameFieldsInfo => {
  return useMemo(() => {
    const meta = {
      fieldsAsOptions: [],
      fieldByDisplayName: {},
    };

    if (!Array.isArray(data)) {
      return meta;
    }

    return data.reduce((meta: DataFrameFieldsInfo, frame) => {
      return frame.fields.reduce((meta, field) => {
        const fieldName = getFieldDisplayName(field, frame, data);

        if (meta.fieldByDisplayName[fieldName]) {
          return meta;
        }

        meta.fieldsAsOptions.push({
          label: fieldName,
          value: fieldName,
          type: field.type,
        });

        meta.fieldByDisplayName[fieldName] = field;

        return meta;
      }, meta);
    }, meta);
  }, [data]);
};
