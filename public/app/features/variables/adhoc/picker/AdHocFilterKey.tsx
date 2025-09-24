import { ReactElement } from 'react';

import { AdHocVariableFilter, DataSourceRef, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, SegmentAsync } from '@grafana/ui';

import { getDatasourceSrv } from '../../../plugins/datasource_srv';

interface Props {
  datasource: DataSourceRef;
  filterKey: string | null;
  onChange: (item: SelectableValue<string | null>) => void;
  allFilters: AdHocVariableFilter[];
  disabled?: boolean;
}

const MIN_WIDTH = 90;
export const AdHocFilterKey = ({ datasource, onChange, disabled, filterKey, allFilters }: Props) => {
  const loadKeys = () => fetchFilterKeys(datasource, filterKey, allFilters);
  const loadKeysWithRemove = () => fetchFilterKeysWithRemove(datasource, filterKey, allFilters);

  const plusSegment: ReactElement = (
    <span
      className="gf-form-label query-part"
      aria-label={t('variables.ad-hoc-filter-key.plus-segment.aria-label-add-filter', 'Add Filter')}
    >
      <Icon name="plus" />
    </span>
  );

  if (filterKey === null) {
    return (
      <div className="gf-form" data-testid="AdHocFilterKey-add-key-wrapper">
        <SegmentAsync
          disabled={disabled}
          className="query-segment-key"
          Component={plusSegment}
          value={filterKey}
          onChange={onChange}
          loadOptions={loadKeys}
          inputMinWidth={MIN_WIDTH}
        />
      </div>
    );
  }

  return (
    <div className="gf-form" data-testid="AdHocFilterKey-key-wrapper">
      <SegmentAsync
        disabled={disabled}
        className="query-segment-key"
        value={filterKey}
        onChange={onChange}
        loadOptions={loadKeysWithRemove}
        inputMinWidth={MIN_WIDTH}
      />
    </div>
  );
};

export const REMOVE_FILTER_KEY = '-- remove filter --';
const REMOVE_VALUE = { label: REMOVE_FILTER_KEY, value: REMOVE_FILTER_KEY };

const fetchFilterKeys = async (
  datasource: DataSourceRef,
  currentKey: string | null,
  allFilters: AdHocVariableFilter[]
): Promise<Array<SelectableValue<string>>> => {
  const ds = await getDatasourceSrv().get(datasource);

  if (!ds || !ds.getTagKeys) {
    return [];
  }

  const otherFilters = allFilters.filter((f) => f.key !== currentKey);
  const response = await ds.getTagKeys({ filters: otherFilters });
  const metrics = Array.isArray(response) ? response : response.data;
  return metrics.map((m) => ({ label: m.text, value: m.text }));
};

const fetchFilterKeysWithRemove = async (
  datasource: DataSourceRef,
  currentKey: string | null,
  allFilters: AdHocVariableFilter[]
): Promise<Array<SelectableValue<string>>> => {
  const keys = await fetchFilterKeys(datasource, currentKey, allFilters);
  return [REMOVE_VALUE, ...keys];
};
