import React, { ChangeEvent, FormEvent, FunctionComponent, useCallback } from 'react';
import { InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { VariableWithMultiSupport } from '../types';
import { VariableEditorProps } from './types';
import { toVariableIdentifier, VariableIdentifier } from '../state/types';
import { VariableSectionHeader } from './VariableSectionHeader';
import { VariableSwitchField } from './VariableSwitchField';
import { VariableTextField } from './VariableTextField';

export interface SelectionOptionsEditorProps<Model extends VariableWithMultiSupport = VariableWithMultiSupport>
  extends VariableEditorProps<Model> {
  onMultiChanged: (identifier: VariableIdentifier, value: boolean) => void;
}

export const SelectionOptionsEditor: FunctionComponent<SelectionOptionsEditorProps> = ({
  onMultiChanged: onMultiChangedProps,
  onPropChange,
  variable,
}) => {
  const onMultiChanged = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onMultiChangedProps(toVariableIdentifier(variable), event.target.checked);
    },
    [onMultiChangedProps, variable]
  );

  const onIncludeAllChanged = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onPropChange({ propName: 'includeAll', propValue: event.target.checked });
    },
    [onPropChange]
  );

  const onAllValueChanged = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      onPropChange({ propName: 'allValue', propValue: event.currentTarget.value });
    },
    [onPropChange]
  );

  return (
    <VerticalGroup spacing="none">
      <VariableSectionHeader name="Selection options" />
      <InlineFieldRow>
        <VariableSwitchField
          value={variable.multi}
          name="Multi-value"
          tooltip="Enables multiple values to be selected at the same time"
          onChange={onMultiChanged}
          ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch}
        />
      </InlineFieldRow>
      <InlineFieldRow>
        <VariableSwitchField
          value={variable.includeAll}
          name="Include All option"
          tooltip="Enables an option to include all variables"
          onChange={onIncludeAllChanged}
          ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch}
        />
      </InlineFieldRow>
      {variable.includeAll && (
        <InlineFieldRow>
          <VariableTextField
            value={variable.allValue ?? ''}
            onChange={onAllValueChanged}
            name="Custom all value"
            placeholder="blank = auto"
            ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput}
            labelWidth={20}
          />
        </InlineFieldRow>
      )}
    </VerticalGroup>
  );
};
SelectionOptionsEditor.displayName = 'SelectionOptionsEditor';
