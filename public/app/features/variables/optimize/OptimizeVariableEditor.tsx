import { PureComponent } from 'react';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';

import { StoreState } from 'app/types';

import { OptimizeVariableModel, SelectableValue } from '../../../../../packages/grafana-data';
import { connectWithStore } from '../../../core/utils/connectWithReduxStore';
import { VariableSelectField } from '../../dashboard-scene/settings/variables/components/VariableSelectField';
import { VariableEditorProps } from '../editor/types';

interface OwnProps extends VariableEditorProps<OptimizeVariableModel> {}

interface ConnectedProps {}

interface DispatchProps {}

export type Props = OwnProps & ConnectedProps & DispatchProps;

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, ownProps) => ({
  dashboard: state.dashboard.getModel(),
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {};

class OptimizeVariableEditorUnconnected extends PureComponent<VariableEditorProps<OptimizeVariableModel>> {
  selected: SelectableValue<string> = {};
  private static OPTIONS = [{ label: 'Domain filter', value: 'domain-filter' }];

  constructor(props: Props) {
    super(props);
    this.selected = OptimizeVariableEditorUnconnected.OPTIONS[0];
  }
  render() {
    return (
      <>
        <VariableSelectField
          name="Select optimize variable type"
          options={OptimizeVariableEditorUnconnected.OPTIONS}
          value={this.selected}
          onChange={(option: SelectableValue<string>) => {}}
        />
      </>
    );
  }
}

export const OptimizeVariableEditor = connectWithStore(
  OptimizeVariableEditorUnconnected,
  mapStateToProps,
  mapDispatchToProps
);
