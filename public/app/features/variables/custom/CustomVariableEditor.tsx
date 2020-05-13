import React, { ChangeEvent, FocusEvent, PureComponent } from 'react';
import { CustomVariableModel, VariableWithMultiSupport } from '../../templating/types';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { OnPropChangeArguments, VariableEditorProps } from '../editor/types';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { StoreState } from 'app/types';
import { changeVariableMultiValue } from '../state/actions';
import { VariableIdentifier } from '../state/types';
import { ThunkResult } from '../../../types';
import { LegacyForms } from '@grafana/ui';

const { Switch } = LegacyForms;

interface OwnProps extends VariableEditorProps<CustomVariableModel> {}

interface ConnectedProps {}

interface DispatchProps {
  changeVariableMultiValue: typeof changeVariableMultiValue;
}

export type Props = OwnProps & ConnectedProps & DispatchProps;

class CustomVariableEditorUnconnected extends PureComponent<Props> {
  onChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.target.value,
    });
  };

  onNoClearChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'noclear',
      propValue: event.target.checked,
    });
  };

  onEditableChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'editable',
      propValue: event.target.checked,
    });
  };

  onSelectionOptionsChange = async ({ propName, propValue }: OnPropChangeArguments<VariableWithMultiSupport>) => {
    this.props.onPropChange({ propName, propValue, updateOptions: true });
  };

  onMultiChange = (identifier: VariableIdentifier, multi: boolean): ThunkResult<void> => {
    if (multi) {
      this.props.onPropChange({ propName: 'noclear', propValue: false });
      this.props.onPropChange({ propName: 'editable', propValue: false });
    }
    return this.props.changeVariableMultiValue(identifier, multi);
  };

  onBlur = (event: FocusEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.target.value,
      updateOptions: true,
    });
  };

  render() {
    return (
      <>
        <div className="gf-form-group">
          <h5 className="section-heading">Custom Options</h5>
          <div className="gf-form">
            <span className="gf-form-label width-14">Values separated by comma</span>
            <input
              type="text"
              className="gf-form-input"
              value={this.props.variable.query}
              onChange={this.onChange}
              onBlur={this.onBlur}
              placeholder="1, 10, 20, myvalue, escaped\,value"
              required
              aria-label="Variable editor Form Custom Query field"
            />
          </div>
          {!this.props.variable.multi && (
            <div className="section">
              <Switch
                label="Do not clear"
                labelClass="width-10"
                checked={this.props.variable.noclear}
                onChange={this.onNoClearChange}
                tooltip={'Keep text of current option in textbox to simplify copy-paste'}
              />
              <Switch
                label="Make editable"
                labelClass="width-10"
                checked={this.props.variable.editable}
                onChange={this.onEditableChange}
                tooltip={'Add current option to dropdown list'}
              />
            </div>
          )}
        </div>
        <SelectionOptionsEditor
          variable={this.props.variable}
          onPropChange={this.onSelectionOptionsChange}
          onMultiChanged={this.onMultiChange}
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
