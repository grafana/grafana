import React, { ComponentType, PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { bindActionCreators } from 'redux';

import { LoadingState } from '@grafana/data';
import { ClickOutsideWrapper } from '@grafana/ui';
import { StoreState, ThunkDispatch } from 'app/types';

import { VARIABLE_PREFIX } from '../../constants';
import { isMulti } from '../../guard';
import { getVariableQueryRunner } from '../../query/VariableQueryRunner';
import { formatVariableLabel } from '../../shared/formatVariable';
import { toKeyedAction } from '../../state/keyedVariablesReducer';
import { getVariablesState } from '../../state/selectors';
import { KeyedVariableIdentifier } from '../../state/types';
import { VariableOption, VariableWithMultiSupport, VariableWithOptions } from '../../types';
import { toKeyedVariableIdentifier } from '../../utils';
import { VariableInput } from '../shared/VariableInput';
import { VariableLink } from '../shared/VariableLink';
import VariableOptions from '../shared/VariableOptions';
import { NavigationKey, VariablePickerProps } from '../types';

import { commitChangesToVariable, filterOrSearchOptions, navigateOptions, openOptions } from './actions';
import { initialOptionPickerState, OptionsPickerState, toggleAllOptions, toggleOption } from './reducer';

export const optionPickerFactory = <Model extends VariableWithOptions | VariableWithMultiSupport>(): ComponentType<
  VariablePickerProps<Model>
> => {
  const mapDispatchToProps = (dispatch: ThunkDispatch) => {
    return {
      ...bindActionCreators({ openOptions, commitChangesToVariable, navigateOptions }, dispatch),
      filterOrSearchOptions: (identifier: KeyedVariableIdentifier, filter = '') => {
        dispatch(filterOrSearchOptions(identifier, filter));
      },
      toggleAllOptions: (identifier: KeyedVariableIdentifier) =>
        dispatch(toKeyedAction(identifier.rootStateKey, toggleAllOptions())),
      toggleOption: (
        identifier: KeyedVariableIdentifier,
        option: VariableOption,
        clearOthers: boolean,
        forceSelect: boolean
      ) => dispatch(toKeyedAction(identifier.rootStateKey, toggleOption({ option, clearOthers, forceSelect }))),
    };
  };

  const mapStateToProps = (state: StoreState, ownProps: OwnProps) => {
    const { rootStateKey } = ownProps.variable;
    if (!rootStateKey) {
      console.error('OptionPickerFactory: variable has no rootStateKey');
      return {
        picker: initialOptionPickerState,
      };
    }

    return {
      picker: getVariablesState(rootStateKey, state).optionsPicker,
    };
  };

  const connector = connect(mapStateToProps, mapDispatchToProps);

  interface OwnProps extends VariablePickerProps<Model> {}

  type Props = OwnProps & ConnectedProps<typeof connector>;

  class OptionsPickerUnconnected extends PureComponent<Props> {
    onShowOptions = () =>
      this.props.openOptions(toKeyedVariableIdentifier(this.props.variable), this.props.onVariableChange);
    onHideOptions = () => {
      if (!this.props.variable.rootStateKey) {
        console.error('Variable has no rootStateKey');
        return;
      }

      this.props.commitChangesToVariable(this.props.variable.rootStateKey, this.props.onVariableChange);
    };

    onToggleOption = (option: VariableOption, clearOthers: boolean) => {
      const toggleFunc =
        isMulti(this.props.variable) && this.props.variable.multi
          ? this.onToggleMultiValueVariable
          : this.onToggleSingleValueVariable;
      toggleFunc(option, clearOthers);
    };

    onToggleSingleValueVariable = (option: VariableOption, clearOthers: boolean) => {
      this.props.toggleOption(toKeyedVariableIdentifier(this.props.variable), option, clearOthers, false);
      this.onHideOptions();
    };

    onToggleMultiValueVariable = (option: VariableOption, clearOthers: boolean) => {
      this.props.toggleOption(toKeyedVariableIdentifier(this.props.variable), option, clearOthers, false);
    };

    onToggleAllOptions = () => {
      this.props.toggleAllOptions(toKeyedVariableIdentifier(this.props.variable));
    };

    onFilterOrSearchOptions = (filter: string) => {
      this.props.filterOrSearchOptions(toKeyedVariableIdentifier(this.props.variable), filter);
    };

    onNavigate = (key: NavigationKey, clearOthers: boolean) => {
      if (!this.props.variable.rootStateKey) {
        console.error('Variable has no rootStateKey');
        return;
      }

      this.props.navigateOptions(this.props.variable.rootStateKey, key, clearOthers);
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
          id={VARIABLE_PREFIX + variable.id}
          text={linkText}
          onClick={this.onShowOptions}
          loading={loading}
          onCancel={this.onCancel}
          disabled={this.props.readOnly}
        />
      );
    }

    onCancel = () => {
      getVariableQueryRunner().cancelRequest(toKeyedVariableIdentifier(this.props.variable));
    };

    renderOptions(picker: OptionsPickerState) {
      const { id } = this.props.variable;
      return (
        <ClickOutsideWrapper onClick={this.onHideOptions}>
          <VariableInput
            id={VARIABLE_PREFIX + id}
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
