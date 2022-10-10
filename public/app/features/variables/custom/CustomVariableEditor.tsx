import React, { FormEvent, PureComponent } from 'react';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';

import { selectors } from '@grafana/e2e-selectors';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { StoreState } from 'app/types';

import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { VariableLegend } from '../editor/VariableLegend';
import { VariableTextAreaField } from '../editor/VariableTextAreaField';
import { OnPropChangeArguments, VariableEditorProps } from '../editor/types';
import { changeVariableMultiValue } from '../state/actions';
import { CustomVariableModel, VariableWithMultiSupport } from '../types';

interface OwnProps extends VariableEditorProps<CustomVariableModel> {}

interface ConnectedProps {}

interface DispatchProps {
  changeVariableMultiValue: typeof changeVariableMultiValue;
}

export type Props = OwnProps & ConnectedProps & DispatchProps;

class CustomVariableEditorUnconnected extends PureComponent<Props> {
  onChange = (event: FormEvent<HTMLTextAreaElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.currentTarget.value,
    });
  };

  onSelectionOptionsChange = async ({ propName, propValue }: OnPropChangeArguments<VariableWithMultiSupport>) => {
    this.props.onPropChange({ propName, propValue, updateOptions: true });
  };

  onBlur = (event: FormEvent<HTMLTextAreaElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.currentTarget.value,
      updateOptions: true,
    });
  };

  render() {
    return (
      <>
        <VariableLegend>Custom options</VariableLegend>

        <VariableTextAreaField
          name="Values separated by comma"
          value={this.props.variable.query}
          placeholder="1, 10, mykey : myvalue, myvalue, escaped\,value"
          onChange={this.onChange}
          onBlur={this.onBlur}
          required
          width={52}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput}
        />
        <VariableLegend>Selection options</VariableLegend>
        <SelectionOptionsEditor
          variable={this.props.variable}
          onPropChange={this.onSelectionOptionsChange}
          onMultiChanged={this.props.changeVariableMultiValue}
        />
      </>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, ownProps) => ({});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  changeVariableMultiValue,
};

export const CustomVariableEditor = connectWithStore(
  CustomVariableEditorUnconnected,
  mapStateToProps,
  mapDispatchToProps
);
