import { css } from '@emotion/css';
import { type ComponentType, memo } from 'react';
import { connect, type ConnectedProps } from 'react-redux';
import { bindActionCreators } from 'redux';

import {
  LoadingState,
  type VariableOption,
  type VariableWithMultiSupport,
  type VariableWithOptions,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ClickOutsideWrapper } from '@grafana/ui';
import { type StoreState, type ThunkDispatch } from 'app/types/store';

import { VARIABLE_PREFIX } from '../../constants';
import { isMulti } from '../../guard';
import { getVariableQueryRunner } from '../../query/VariableQueryRunner';
import { formatVariableLabel } from '../../shared/formatVariable';
import { toKeyedAction } from '../../state/keyedVariablesReducer';
import { getVariablesState } from '../../state/selectors';
import { type KeyedVariableIdentifier } from '../../state/types';
import { toKeyedVariableIdentifier } from '../../utils';
import { VariableInput } from '../shared/VariableInput';
import { VariableLink } from '../shared/VariableLink';
import { VariableOptions } from '../shared/VariableOptions';
import { type NavigationKey, type VariablePickerProps } from '../types';

import { commitChangesToVariable, filterOrSearchOptions, navigateOptions, openOptions } from './actions';
import { initialOptionPickerState, type OptionsPickerState, toggleAllOptions, toggleOption } from './reducer';

const styles = {
  variableLinkWrapper: css({
    display: 'inline-block',
    position: 'relative',
  }),
};

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

  const OptionsPickerUnconnected = memo(function OptionsPickerUnconnected({
    variable,
    picker,
    openOptions,
    commitChangesToVariable,
    navigateOptions,
    filterOrSearchOptions,
    toggleAllOptions,
    toggleOption,
    onVariableChange,
    readOnly,
  }: Props) {
    function onShowOptions() {
      openOptions(toKeyedVariableIdentifier(variable), onVariableChange);
    }

    function onHideOptions() {
      if (!variable.rootStateKey) {
        console.error('Variable has no rootStateKey');
        return;
      }
      commitChangesToVariable(variable.rootStateKey, onVariableChange);
    }

    function onToggleSingleValueVariable(option: VariableOption, clearOthers: boolean) {
      toggleOption(toKeyedVariableIdentifier(variable), option, clearOthers, false);
      onHideOptions();
    }

    function onToggleMultiValueVariable(option: VariableOption, clearOthers: boolean) {
      toggleOption(toKeyedVariableIdentifier(variable), option, clearOthers, false);
    }

    function onToggleOption(option: VariableOption, clearOthers: boolean) {
      const toggleFunc = isMulti(variable) && variable.multi ? onToggleMultiValueVariable : onToggleSingleValueVariable;
      toggleFunc(option, clearOthers);
    }

    function onToggleAllOptions() {
      toggleAllOptions(toKeyedVariableIdentifier(variable));
    }

    function onFilterOrSearchOptions(filter: string) {
      filterOrSearchOptions(toKeyedVariableIdentifier(variable), filter);
    }

    function onNavigate(key: NavigationKey, clearOthers: boolean) {
      if (!variable.rootStateKey) {
        console.error('Variable has no rootStateKey');
        return;
      }
      navigateOptions(variable.rootStateKey, key, clearOthers);
    }

    function onCancel() {
      getVariableQueryRunner().cancelRequest(toKeyedVariableIdentifier(variable));
    }

    function renderLink(variable: VariableWithOptions) {
      const linkText = formatVariableLabel(variable);
      const loading = variable.state === LoadingState.Loading;

      return (
        <VariableLink
          id={VARIABLE_PREFIX + variable.id}
          text={linkText}
          onClick={onShowOptions}
          loading={loading}
          onCancel={onCancel}
          disabled={readOnly}
        />
      );
    }

    function renderOptions(picker: OptionsPickerState) {
      const { id } = variable;
      return (
        <ClickOutsideWrapper onClick={onHideOptions}>
          <VariableInput
            id={VARIABLE_PREFIX + id}
            value={picker.queryValue}
            onChange={onFilterOrSearchOptions}
            onNavigate={onNavigate}
            aria-expanded={true}
            aria-controls={`options-${id}`}
          />
          <VariableOptions
            values={picker.options}
            onToggle={onToggleOption}
            onToggleAll={onToggleAllOptions}
            highlightIndex={picker.highlightIndex}
            multi={picker.multi}
            selectedValues={picker.selectedValues}
            id={`options-${id}`}
          />
        </ClickOutsideWrapper>
      );
    }

    const showOptions = picker.id === variable.id;

    return (
      <div className={styles.variableLinkWrapper} data-testid={selectors.components.Variables.variableLinkWrapper}>
        {showOptions ? renderOptions(picker) : renderLink(variable)}
      </div>
    );
  });

  const OptionsPicker = connector(OptionsPickerUnconnected);
  OptionsPicker.displayName = 'OptionsPicker';

  return OptionsPicker;
};
