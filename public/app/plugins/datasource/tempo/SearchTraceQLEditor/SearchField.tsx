import { css } from '@emotion/css';
import { uniq } from 'lodash';
import { useState, useEffect, useMemo } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { SelectableValue } from '@grafana/data';
import { TemporaryAlert } from '@grafana/o11y-ds-frontend';
import { FetchError, getTemplateSrv, isFetchError } from '@grafana/runtime';
import { Select, HorizontalGroup, useStyles2, InputActionMeta } from '@grafana/ui';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import { operators as allOperators, stringOperators, numberOperators, keywordOperators } from '../traceql/traceql';

import { filterScopedTag, operatorSelectableValue } from './utils';

const getStyles = () => ({
  dropdown: css({
    boxShadow: 'none',
  }),
});

interface Props {
  filter: TraceqlFilter;
  datasource: TempoDatasource;
  updateFilter: (f: TraceqlFilter) => void;
  deleteFilter?: (f: TraceqlFilter) => void;
  setError: (error: FetchError | null) => void;
  isTagsLoading?: boolean;
  tags: string[];
  hideScope?: boolean;
  hideTag?: boolean;
  hideValue?: boolean;
  query: string;
  isMulti?: boolean;
  allowCustomValue?: boolean;
  addVariablesToOptions?: boolean;
}
const SearchField = ({
  filter,
  datasource,
  updateFilter,
  isTagsLoading,
  tags,
  setError,
  hideScope,
  hideTag,
  hideValue,
  query,
  addVariablesToOptions,
  isMulti = true,
  allowCustomValue = true,
}: Props) => {
  const styles = useStyles2(getStyles);
  const [alertText, setAlertText] = useState<string>();
  const scopedTag = useMemo(() => filterScopedTag(filter), [filter]);
  // We automatically change the operator to the regex op when users select 2 or more values
  // However, they expect this to be automatically rolled back to the previous operator once
  // there's only one value selected, so we store the previous operator and value
  const [prevOperator, setPrevOperator] = useState(filter.operator);
  const [prevValue, setPrevValue] = useState(filter.value);
  const [tagQuery, setTagQuery] = useState<string>('');
  const [tagValuesQuery, setTagValuesQuery] = useState<string>('');

  const updateOptions = async () => {
    try {
      const result = filter.tag ? await datasource.languageProvider.getOptionsV2(scopedTag, query) : [];
      setAlertText(undefined);
      setError(null);
      return result;
    } catch (error) {
      // Display message if Tempo is connected but search 404's
      if (isFetchError(error) && error?.status === 404) {
        setError(error);
      } else if (error instanceof Error) {
        setAlertText(`Error: ${error.message}`);
      }
    }
    return [];
  };

  const { loading: isLoadingValues, value: options } = useAsync(updateOptions, [
    scopedTag,
    datasource.languageProvider,
    setError,
    query,
  ]);

  // Add selected option if it doesn't exist in the current list of options
  if (filter.value && !Array.isArray(filter.value) && options && !options.find((o) => o.value === filter.value)) {
    options.push({ label: filter.value.toString(), value: filter.value.toString(), type: filter.valueType });
  }

  useEffect(() => {
    if (
      Array.isArray(filter.value) &&
      filter.value.length > 1 &&
      filter.operator !== '=~' &&
      filter.operator !== '!~'
    ) {
      setPrevOperator(filter.operator);
      updateFilter({ ...filter, operator: '=~' });
    }
    if (Array.isArray(filter.value) && filter.value.length <= 1 && (prevValue?.length || 0) > 1) {
      updateFilter({ ...filter, operator: prevOperator, value: filter.value[0] });
    }
  }, [prevValue, prevOperator, updateFilter, filter]);

  useEffect(() => {
    setPrevValue(filter.value);
  }, [filter.value]);

  const scopeOptions = Object.values(TraceqlSearchScope)
    .filter((s) => s !== TraceqlSearchScope.Intrinsic)
    .map((t) => ({ label: t, value: t }));

  // If all values have type string or int/float use a focused list of operators instead of all operators
  const optionsOfFirstType = options?.filter((o) => o.type === options[0]?.type);
  const uniqueOptionType = options?.length === optionsOfFirstType?.length ? options?.[0]?.type : undefined;
  let operatorList = allOperators;
  switch (uniqueOptionType) {
    case 'keyword':
      operatorList = keywordOperators;
      break;
    case 'string':
      operatorList = stringOperators;
      break;
    case 'int':
    case 'float':
      operatorList = numberOperators;
  }
  const operatorOptions = operatorList.map(operatorSelectableValue);

  const formatTagOptions = (tags: string[], filterTag: string | undefined) => {
    return (filterTag !== undefined ? uniq([filterTag, ...tags]) : tags).map((t) => ({ label: t, value: t }));
  };

  const tagOptions = useMemo(() => {
    if (tagQuery.length === 0) {
      return formatTagOptions(tags.slice(0, maxOptions), filter.tag);
    }

    const queryLowerCase = tagQuery.toLowerCase();
    const filterdOptions = tags.filter((tag) => tag.toLowerCase().includes(queryLowerCase)).slice(0, maxOptions);
    return formatTagOptions(filterdOptions, filter.tag);
  }, [filter.tag, tagQuery, tags]);

  const tagValueOptions = useMemo(() => {
    if (!options) {
      return;
    }

    if (tagValuesQuery.length === 0) {
      return options.slice(0, maxOptions);
    }

    const queryLowerCase = tagValuesQuery.toLowerCase();
    return options
      .filter((tag) => {
        if (tag.value && tag.value.length > 0) {
          return tag.value.toLowerCase().includes(queryLowerCase);
        }
        return false;
      })
      .slice(0, maxOptions);
  }, [tagValuesQuery, options]);

  return (
    <>
      <HorizontalGroup spacing={'none'} width={'auto'}>
        {!hideScope && (
          <Select
            className={styles.dropdown}
            inputId={`${filter.id}-scope`}
            options={addVariablesToOptions ? withTemplateVariableOptions(scopeOptions) : scopeOptions}
            value={filter.scope}
            onChange={(v) => updateFilter({ ...filter, scope: v?.value })}
            placeholder="Select scope"
            aria-label={`select ${filter.id} scope`}
          />
        )}
        {!hideTag && (
          <Select
            className={styles.dropdown}
            inputId={`${filter.id}-tag`}
            isLoading={isTagsLoading}
            // Add the current tag to the list if it doesn't exist in the tags prop, otherwise the field will be empty even though the state has a value
            options={addVariablesToOptions ? withTemplateVariableOptions(tagOptions) : tagOptions}
            onInputChange={(value: string, { action }: InputActionMeta) => {
              if (action === 'input-change') {
                setTagQuery(value);
              }
            }}
            onCloseMenu={() => setTagQuery('')}
            onChange={(v) => updateFilter({ ...filter, tag: v?.value, value: [] })}
            value={filter.tag}
            placeholder="Select tag"
            isClearable
            aria-label={`select ${filter.id} tag`}
            allowCustomValue
            virtualized
          />
        )}
        <Select
          className={styles.dropdown}
          inputId={`${filter.id}-operator`}
          options={addVariablesToOptions ? withTemplateVariableOptions(operatorOptions) : operatorOptions}
          value={filter.operator}
          onChange={(v) => updateFilter({ ...filter, operator: v?.value })}
          isClearable={false}
          aria-label={`select ${filter.id} operator`}
          allowCustomValue={true}
          width={8}
        />
        {!hideValue && (
          <Select
            /**
             * Trace cardinality means we need to use the virtualized variant of the Select component.
             * For example the number of span names being returned can easily reach 10s of thousands,
             * which is enough to cause a user's web browser to seize up
             */
            virtualized
            className={styles.dropdown}
            inputId={`${filter.id}-value`}
            isLoading={isLoadingValues}
            options={addVariablesToOptions ? withTemplateVariableOptions(tagValueOptions) : tagValueOptions}
            value={filter.value}
            onInputChange={(value: string, { action }: InputActionMeta) => {
              if (action === 'input-change') {
                setTagValuesQuery(value);
              }
            }}
            onCloseMenu={() => setTagValuesQuery('')}
            onChange={(val) => {
              if (Array.isArray(val)) {
                updateFilter({
                  ...filter,
                  value: val.map((v) => v.value),
                  valueType: val[0]?.type || uniqueOptionType,
                });
              } else {
                updateFilter({ ...filter, value: val?.value, valueType: val?.type || uniqueOptionType });
              }
            }}
            placeholder="Select value"
            isClearable={true}
            aria-label={`select ${filter.id} value`}
            allowCustomValue={allowCustomValue}
            isMulti={isMulti}
            allowCreateWhileLoading
          />
        )}
      </HorizontalGroup>
      {alertText && <TemporaryAlert severity="error" text={alertText} />}
    </>
  );
};

/**
 * Add to a list of options the current template variables.
 *
 * @param options a list of options
 * @returns the list of given options plus the template variables
 */
export const withTemplateVariableOptions = (options: SelectableValue[] | undefined) => {
  const templateVariables = getTemplateSrv().getVariables();
  return [...(options || []), ...templateVariables.map((v) => ({ label: `$${v.name}`, value: `$${v.name}` }))];
};

// Limit maximum options in select dropdowns for performance reasons
export const maxOptions = 1000;

export default SearchField;
