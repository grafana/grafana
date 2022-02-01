import React, { ComponentType, PureComponent } from 'react';
import { bindActionCreators } from 'redux';
import { connect, ConnectedProps } from 'react-redux';
import { ClickOutsideWrapper } from '@grafana/ui';
import { LoadingState } from '@grafana/data';

import { StoreState, ThunkDispatch } from 'app/types';
import { VariableInput } from '../shared/VariableInput';
import { commitChangesToVariable, filterOrSearchOptions, navigateOptions, openOptions } from './actions';
import { initialOptionPickerState, OptionsPickerState, toggleAllOptions, toggleOption } from './reducer';
import { VariableOption, VariableWithMultiSupport, VariableWithOptions } from '../../types';
import { VariableOptions } from '../shared/VariableOptions';
import { isMulti } from '../../guard';
import { NavigationKey, VariablePickerProps } from '../types';
import { formatVariableLabel } from '../../shared/formatVariable';
import { DashboardVariableIdentifier } from '../../state/types';
import { getVariableQueryRunner } from '../../query/VariableQueryRunner';
import { VariableLink } from '../shared/VariableLink';
import { getDashboardVariablesState } from '../../state/selectors';
import { toKeyedAction } from '../../state/keyedVariablesReducer';
import { toDashboardVariableIdentifier } from '../../utils';

export const optionPickerFactory = <Model extends VariableWithOptions | VariableWithMultiSupport>(): ComponentType<
  VariablePickerProps<Model>
> => {
  const mapDispatchToProps = (dispatch: ThunkDispatch) => {
    return {
      ...bindActionCreators({ openOptions, commitChangesToVariable, navigateOptions }, dispatch),
      filterOrSearchOptions: (identifier: DashboardVariableIdentifier, filter = '') => {
        dispatch(filterOrSearchOptions(identifier, filter));
      },
      toggleAllOptions: (identifier: DashboardVariableIdentifier) =>
        dispatch(toKeyedAction(identifier.dashboardUid, toggleAllOptions())),
      toggleOption: (
        identifier: DashboardVariableIdentifier,
        option: VariableOption,
        clearOthers: boolean,
        forceSelect: boolean
      ) => dispatch(toKeyedAction(identifier.dashboardUid, toggleOption({ option, clearOthers, forceSelect }))),
    };
  };

  const mapStateToProps = (state: StoreState, ownProps: OwnProps) => {
    const { dashboardUid: uid } = ownProps.variable;
    if (!uid) {
      console.error('OptionPickerFactory: variable has no dashboardUid');
      return {
        picker: initialOptionPickerState,
      };
    }

    return {
      picker: getDashboardVariablesState(uid, state).optionsPicker,
    };
  };

  const connector = connect(mapStateToProps, mapDispatchToProps);

  interface OwnProps extends VariablePickerProps<Model> {}

  type Props = OwnProps & ConnectedProps<typeof connector>;

  class OptionsPickerUnconnected extends PureComponent<Props> {
    onShowOptions = () =>
      this.props.openOptions(toDashboardVariableIdentifier(this.props.variable), this.props.onVariableChange);
    onHideOptions = () => {
      if (!this.props.variable.dashboardUid) {
        console.error('Variable has no dashboardUid');
        return;
      }

      this.props.commitChangesToVariable(this.props.variable.dashboardUid, this.props.onVariableChange);
    };

    onToggleOption = (option: VariableOption, clearOthers: boolean) => {
      const toggleFunc =
        isMulti(this.props.variable) && this.props.variable.multi
          ? this.onToggleMultiValueVariable
          : this.onToggleSingleValueVariable;
      toggleFunc(option, clearOthers);
    };

    onToggleSingleValueVariable = (option: VariableOption, clearOthers: boolean) => {
      this.props.toggleOption(toDashboardVariableIdentifier(this.props.variable), option, clearOthers, false);
      this.onHideOptions();
    };

    onToggleMultiValueVariable = (option: VariableOption, clearOthers: boolean) => {
      this.props.toggleOption(toDashboardVariableIdentifier(this.props.variable), option, clearOthers, false);
    };

    onToggleAllOptions = () => {
      this.props.toggleAllOptions(toDashboardVariableIdentifier(this.props.variable));
    };

    onFilterOrSearchOptions = (filter: string) => {
      this.props.filterOrSearchOptions(toDashboardVariableIdentifier(this.props.variable), filter);
    };

    onNavigate = (key: NavigationKey, clearOthers: boolean) => {
      if (!this.props.variable.dashboardUid) {
        console.error('Variable has no dashboardUid');
        return;
      }

      this.props.navigateOptions(this.props.variable.dashboardUid, key, clearOthers);
    };

    render() {
      const { variable, picker } = this.props;
      const showOptions = picker.id === variable.id;

      return (
        <div className="variable-link-wrapper">
          {showOptions ? this.renderOptions(picker) : this.renderLink(variable)}
        </div>
      );
    }

    renderLink(variable: VariableWithOptions) {
      const linkText = formatVariableLabel(variable);
      const loading = variable.state === LoadingState.Loading;

      return (
        <VariableLink
          id={variable.id}
          text={linkText}
          onClick={this.onShowOptions}
          loading={loading}
          onCancel={this.onCancel}
        />
      );
    }

    onCancel = () => {
      getVariableQueryRunner().cancelRequest(toDashboardVariableIdentifier(this.props.variable));
    };

    renderOptions(picker: OptionsPickerState) {
      const { id } = this.props.variable;
      return (
        <ClickOutsideWrapper onClick={this.onHideOptions}>
          <VariableInput
            id={id}
            value={picker.queryValue}
            onChange={this.onFilterOrSearchOptions}
            onNavigate={this.onNavigate}
            aria-expanded={true}
            aria-controls={`options-${id}`}
          />
          <VariableOptions
            values={picker.options}
            onToggle={this.onToggleOption}
            onToggleAll={this.onToggleAllOptions}
            highlightIndex={picker.highlightIndex}
            multi={picker.multi}
            selectedValues={picker.selectedValues}
            id={`options-${id}`}
          />
        </ClickOutsideWrapper>
      );
    }
  }

  const OptionsPicker = connector(OptionsPickerUnconnected);
  OptionsPicker.displayName = 'OptionsPicker';

  return OptionsPicker;
};
