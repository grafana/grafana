import { memo, useCallback } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { AdHocVariableFilter, AdHocVariableModel } from '@grafana/data';

import { VariablePickerProps } from '../../pickers/types';
import { toKeyedVariableIdentifier } from '../../utils';
import { addFilter, changeFilter, removeFilter } from '../actions';

import { AdHocFilter } from './AdHocFilter';

const mapDispatchToProps = {
  addFilter,
  removeFilter,
  changeFilter,
};

const connector = connect(null, mapDispatchToProps);

interface OwnProps extends VariablePickerProps<AdHocVariableModel> {}

type Props = OwnProps & ConnectedProps<typeof connector>;

export const AdHocPickerUnconnected = memo(function AdHocPickerUnconnected(props: Props) {
  const { addFilter, changeFilter, removeFilter, variable, readOnly } = props;

  const handleAddFilter = useCallback(
    (filter: AdHocVariableFilter) => {
      addFilter(toKeyedVariableIdentifier(variable), filter);
    },
    [variable, addFilter]
  );

  const handleRemoveFilter = useCallback(
    (index: number) => {
      removeFilter(toKeyedVariableIdentifier(variable), index);
    },
    [variable, removeFilter]
  );

  const handleChangeFilter = useCallback(
    (index: number, filter: AdHocVariableFilter) => {
      changeFilter(toKeyedVariableIdentifier(variable), { index, filter });
    },
    [variable, changeFilter]
  );

  const { filters, datasource, baseFilters } = props.variable;

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
AdHocPickerUnconnected.displayName = 'AdHocPickerUnconnected';

export const AdHocPicker = connector(AdHocPickerUnconnected);
AdHocPicker.displayName = 'AdHocPicker';
