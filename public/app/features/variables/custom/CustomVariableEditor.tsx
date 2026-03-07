import { FormEvent, memo, useCallback } from 'react';
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

export const CustomVariableEditorUnconnected = memo(function CustomVariableEditorUnconnected({
  onPropChange,
  variable,
}: Props) {
  const handleSelectionOptionsChange = useCallback(
    async ({ propName, propValue }: OnPropChangeArguments<VariableWithMultiSupport>) => {
      onPropChange({ propName, propValue, updateOptions: true });
    },
    [onPropChange]
  );

  const handleQueryChange = useCallback(
    (event: FormEvent<HTMLTextAreaElement>) => {
      onPropChange({
        propName: 'query',
        propValue: event.currentTarget.value,
        updateOptions: true,
      });
    },
    [onPropChange]
  );

  return (
    <CustomVariableForm
      query={variable.query}
      multi={variable.multi}
      allValue={variable.allValue}
      includeAll={variable.includeAll}
      onQueryChange={handleQueryChange}
      onMultiChange={(event) =>
        handleSelectionOptionsChange({ propName: 'multi', propValue: event.currentTarget.checked })
      }
      onIncludeAllChange={(event) =>
        handleSelectionOptionsChange({ propName: 'includeAll', propValue: event.currentTarget.checked })
      }
      onAllValueChange={(event) =>
        handleSelectionOptionsChange({ propName: 'allValue', propValue: event.currentTarget.value })
      }
    />
  );
});
CustomVariableEditorUnconnected.displayName = 'CustomVariableEditorUnconnected';

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (_state, _ownProps) => ({});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  changeVariableMultiValue,
};

export const CustomVariableEditor = connectWithStore(
  CustomVariableEditorUnconnected,
  mapStateToProps,
  mapDispatchToProps
);
