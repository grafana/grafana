import { type FormEvent, memo } from 'react';

import { type CustomVariableModel, type VariableWithMultiSupport } from '@grafana/data';
import { CustomVariableForm } from 'app/features/dashboard-scene/settings/variables/components/CustomVariableForm';

import { type OnPropChangeArguments, type VariableEditorProps } from '../editor/types';

interface Props extends VariableEditorProps<CustomVariableModel> {}

export const CustomVariableEditor = memo(function CustomVariableEditor({ variable, onPropChange }: Props) {
  const onSelectionOptionsChange = ({ propName, propValue }: OnPropChangeArguments<VariableWithMultiSupport>) => {
    onPropChange({ propName, propValue, updateOptions: true });
  };

  const onQueryChange = (event: FormEvent<HTMLTextAreaElement>) => {
    onPropChange({
      propName: 'query',
      propValue: event.currentTarget.value,
      updateOptions: true,
    });
  };

  return (
    <CustomVariableForm
      query={variable.query}
      multi={variable.multi}
      allValue={variable.allValue}
      includeAll={variable.includeAll}
      onQueryChange={onQueryChange}
      onMultiChange={(event) => onSelectionOptionsChange({ propName: 'multi', propValue: event.currentTarget.checked })}
      onIncludeAllChange={(event) =>
        onSelectionOptionsChange({ propName: 'includeAll', propValue: event.currentTarget.checked })
      }
      onAllValueChange={(event) =>
        onSelectionOptionsChange({ propName: 'allValue', propValue: event.currentTarget.value })
      }
    />
  );
});
