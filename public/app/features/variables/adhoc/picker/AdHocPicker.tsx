import { memo } from 'react';

import { type AdHocVariableFilter, type AdHocVariableModel } from '@grafana/data';
import { useDispatch } from 'app/types/store';

import { type VariablePickerProps } from '../../pickers/types';
import { toKeyedVariableIdentifier } from '../../utils';
import { addFilter, changeFilter, removeFilter } from '../actions';

import { AdHocFilter } from './AdHocFilter';

interface Props extends VariablePickerProps<AdHocVariableModel> {}

/**
 * Thin wrapper over AdHocFilter to add redux actions and change the props so it can be used for ad hoc variable
 * control.
 */
export const AdHocPicker = memo(function AdHocPicker({ variable, readOnly }: Props) {
  const dispatch = useDispatch();
  const { filters, datasource, baseFilters } = variable;

  const handleAddFilter = (filter: AdHocVariableFilter) => {
    dispatch(addFilter(toKeyedVariableIdentifier(variable), filter));
  };

  const handleRemoveFilter = (index: number) => {
    dispatch(removeFilter(toKeyedVariableIdentifier(variable), index));
  };

  const handleChangeFilter = (index: number, filter: AdHocVariableFilter) => {
    dispatch(changeFilter(toKeyedVariableIdentifier(variable), { index, filter }));
  };

  return (
    <AdHocFilter
      datasource={datasource}
      filters={filters}
      baseFilters={baseFilters}
      disabled={readOnly}
      addFilter={handleAddFilter}
      removeFilter={handleRemoveFilter}
      changeFilter={handleChangeFilter}
    />
  );
});
