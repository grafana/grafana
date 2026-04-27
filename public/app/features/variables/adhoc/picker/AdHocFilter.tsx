import { Fragment, memo, type ReactNode } from 'react';

import type { AdHocVariableFilter, DataSourceRef, SelectableValue } from '@grafana/data/types';
import { t } from '@grafana/i18n';
import { Segment } from '@grafana/ui';

import { AdHocFilterBuilder } from './AdHocFilterBuilder';
import { REMOVE_FILTER_KEY } from './AdHocFilterKey';
import { AdHocFilterRenderer } from './AdHocFilterRenderer';
import { ConditionSegment } from './ConditionSegment';

interface Props {
  datasource: DataSourceRef | null;
  filters: AdHocVariableFilter[];
  baseFilters?: AdHocVariableFilter[];
  addFilter: (filter: AdHocVariableFilter) => void;
  removeFilter: (index: number) => void;
  changeFilter: (index: number, newFilter: AdHocVariableFilter) => void;
  disabled?: boolean;
}

/**
 * Simple filtering component that automatically uses datasource APIs to get available labels and its values, for
 * dynamic visual filtering without need for much setup. Instead of having single onChange prop this reports all the
 * change events with separate props so it is usable with AdHocPicker.
 *
 * Note: There isn't API on datasource to suggest the operators here so that is hardcoded to use prometheus style
 * operators. Also filters are assumed to be joined with `AND` operator, which is also hardcoded.
 */
export const AdHocFilter = memo(function AdHocFilter({
  datasource,
  filters,
  baseFilters,
  addFilter,
  removeFilter,
  changeFilter,
  disabled,
}: Props) {
  const connectorLabel = t('variables.ad-hoc-filter.label-and', 'AND');

  const getAllFilters = () => {
    if (baseFilters) {
      return baseFilters.concat(filters);
    }
    return filters;
  };

  const onChange = (index: number, prop: string) => (key: SelectableValue<string | null>) => {
    const { value } = key;

    if (key.value === REMOVE_FILTER_KEY) {
      return removeFilter(index);
    }

    return changeFilter(index, {
      ...filters[index],
      [prop]: value,
    });
  };

  const renderFilterSegments = (filter: AdHocVariableFilter, index: number) => {
    return (
      <Fragment key={`filter-${index}`}>
        <AdHocFilterRenderer
          disabled={disabled}
          datasource={datasource!}
          filter={filter}
          onKeyChange={onChange(index, 'key')}
          onOperatorChange={onChange(index, 'operator')}
          onValueChange={onChange(index, 'value')}
          allFilters={getAllFilters()}
        />
      </Fragment>
    );
  };

  const renderFilters = () => {
    if (filters.length === 0 && disabled) {
      return <Segment disabled={disabled} value="No filters" options={[]} onChange={() => {}} />;
    }

    return filters.reduce((segments: ReactNode[], filter, index) => {
      if (segments.length > 0) {
        segments.push(<ConditionSegment label={connectorLabel} key={`condition-${index}`} />);
      }
      segments.push(renderFilterSegments(filter, index));
      return segments;
    }, []);
  };

  return (
    <div className="gf-form-inline">
      {renderFilters()}

      {!disabled && (
        <AdHocFilterBuilder
          datasource={datasource!}
          appendBefore={filters.length > 0 ? <ConditionSegment label={connectorLabel} /> : null}
          onCompleted={addFilter}
          allFilters={getAllFilters()}
        />
      )}
    </div>
  );
});
