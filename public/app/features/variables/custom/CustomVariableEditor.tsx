import { FormEvent, PureComponent } from 'react';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';

import { CustomVariableModel, VariableWithMultiSupport } from '@grafana/data';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { CustomVariableForm } from 'app/features/dashboard-scene/settings/variables/components/CustomVariableForm';
import { StoreState } from 'app/types/store';

import { OnPropChangeArguments, VariableEditorProps } from '../editor/types';
import { changeVariableMultiValue } from '../state/actions';

interface OwnProps extends VariableEditorProps<CustomVariableModel> {}

interface ConnectedProps {}

interface DispatchProps {
  changeVariableMultiValue: typeof changeVariableMultiValue;
}

export type Props = OwnProps & ConnectedProps & DispatchProps;

class CustomVariableEditorUnconnected extends PureComponent<Props> {
  onSelectionOptionsChange = async ({ propName, propValue }: OnPropChangeArguments<VariableWithMultiSupport>) => {
    this.props.onPropChange({ propName, propValue, updateOptions: true });
  };

  onQueryChange = (event: FormEvent<HTMLTextAreaElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.currentTarget.value,
      updateOptions: true,
    });
  };

  render() {
    return (
      <CustomVariableForm
        query={this.props.variable.query}
        multi={this.props.variable.multi}
        allValue={this.props.variable.allValue}
        includeAll={this.props.variable.includeAll}
        onQueryChange={this.onQueryChange}
        onMultiChange={(event) =>
          this.onSelectionOptionsChange({ propName: 'multi', propValue: event.currentTarget.checked })
        }
        onIncludeAllChange={(event) =>
          this.onSelectionOptionsChange({ propName: 'includeAll', propValue: event.currentTarget.checked })
        }
        onAllValueChange={(event) =>
          this.onSelectionOptionsChange({ propName: 'allValue', propValue: event.currentTarget.value })
        }
      />
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
