import React, { ChangeEvent, FocusEvent, PureComponent } from 'react';
import { Button } from '@grafana/ui';
import { MappingVariableModel, VariableWithMultiSupport } from '../types';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { OnPropChangeArguments, VariableEditorProps } from '../editor/types';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { StoreState } from 'app/types';
import { changeVariableMultiValue } from '../state/actions';

interface OwnProps extends VariableEditorProps<MappingVariableModel> {}

interface ConnectedProps {}

interface DispatchProps {
  changeVariableMultiValue: typeof changeVariableMultiValue;
}

export type Props = OwnProps & ConnectedProps & DispatchProps;

class MappingVariableEditorUnconnected extends PureComponent<Props> {
  onChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.target.value,
    });
  };

  onAddQueryClick = () => {};

  onSelectionOptionsChange = async ({ propName, propValue }: OnPropChangeArguments<VariableWithMultiSupport>) => {
    this.props.onPropChange({ propName, propValue, updateOptions: true });
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
          <h5 className="section-heading">Mapping Options</h5>
          <div className="gf-form">
            <span className="gf-form-label width-14">Map Values</span>
            <input
              type="text"
              className="gf-form-input"
              value={this.props.variable.query}
              onChange={this.onChange}
              onBlur={this.onBlur}
              placeholder="1kg -> 1000"
              required
              aria-label="Variable editor Form Mapping Query field"
            />
            <Button icon="plus" onClick={this.onAddQueryClick} variant="secondary" aria-label={'add-query'}>
              Value Mapping
            </Button>
          </div>
        </div>
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

export const MappingVariableEditor = connectWithStore(
  MappingVariableEditorUnconnected,
  mapStateToProps,
  mapDispatchToProps
);
