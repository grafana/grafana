import React, { ChangeEvent, FocusEvent, PureComponent } from 'react';
import { CustomVariableModel, VariableWithMultiSupport } from '../types';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { OnPropChangeArguments, VariableEditorProps } from '../editor/types';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { VerticalGroup } from '@grafana/ui';
import { StoreState } from 'app/types';
import { changeVariableMultiValue } from '../state/actions';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextAreaField } from '../editor/VariableTextAreaField';

interface OwnProps extends VariableEditorProps<CustomVariableModel> {}

interface ConnectedProps {}

interface DispatchProps {
  changeVariableMultiValue: typeof changeVariableMultiValue;
}

export type Props = OwnProps & ConnectedProps & DispatchProps;

class CustomVariableEditorUnconnected extends PureComponent<Props> {
  onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.target.value,
    });
  };

  onSelectionOptionsChange = async ({ propName, propValue }: OnPropChangeArguments<VariableWithMultiSupport>) => {
    this.props.onPropChange({ propName, propValue, updateOptions: true });
  };

  onBlur = (event: FocusEvent<HTMLTextAreaElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.target.value,
      updateOptions: true,
    });
  };

  render() {
    return (
      <VerticalGroup spacing="xs">
        <VariableSectionHeader name="Custom Options" />
        <VerticalGroup spacing="md">
          <VerticalGroup spacing="none">
            <VariableTextAreaField
              name="Values separated by comma"
              value={this.props.variable.query}
              placeholder="1, 10, mykey : myvalue, myvalue, escaped\,value"
              onChange={this.onChange}
              onBlur={this.onBlur}
              required
              width={50}
              labelWidth={27}
            />
          </VerticalGroup>
          <SelectionOptionsEditor
            variable={this.props.variable}
            onPropChange={this.onSelectionOptionsChange}
            onMultiChanged={this.props.changeVariableMultiValue}
          />{' '}
        </VerticalGroup>
      </VerticalGroup>
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
