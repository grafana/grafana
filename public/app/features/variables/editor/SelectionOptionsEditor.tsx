import React, { FunctionComponent, useCallback } from 'react';
import { LegacyForms } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { VariableWithMultiSupport } from '../../templating/types';
import { VariableEditorProps } from './types';
import { toVariableIdentifier, VariableIdentifier } from '../state/types';

const { Switch } = LegacyForms;

export interface SelectionOptionsEditorProps<Model extends VariableWithMultiSupport = VariableWithMultiSupport>
  extends VariableEditorProps<Model> {
  onMultiChanged: (identifier: VariableIdentifier, value: boolean) => void;
}

export const SelectionOptionsEditor: FunctionComponent<SelectionOptionsEditorProps> = props => {
  const onMultiChanged = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      props.onMultiChanged(toVariableIdentifier(props.variable), event.target.checked);
    },
    [props.onMultiChanged]
  );

  const onIncludeAllChanged = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      props.onPropChange({ propName: 'includeAll', propValue: event.target.checked });
    },
    [props.onPropChange]
  );

  const onAllValueChanged = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      props.onPropChange({ propName: 'allValue', propValue: event.target.value });
    },
    [props.onPropChange]
  );
  return (
    <div className="section gf-form-group">
      <h5 className="section-heading">Selection Options</h5>
      <div className="section">
        <div aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch}>
          <Switch
            label="Multi-value"
            labelClass="width-10"
            checked={props.variable.multi}
            onChange={onMultiChanged}
            tooltip={'Enables multiple values to be selected at the same time'}
          />
        </div>
        <div aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch}>
          <Switch
            label="Include All option"
            labelClass="width-10"
            checked={props.variable.includeAll}
            onChange={onIncludeAllChanged}
            tooltip={'Enables multiple values to be selected at the same time'}
          />
        </div>
      </div>
      {props.variable.includeAll && (
        <div className="gf-form">
          <span className="gf-form-label width-10">Custom all value</span>
          <input
            type="text"
            className="gf-form-input max-width-15"
            value={props.variable.allValue ?? ''}
            onChange={onAllValueChanged}
            placeholder="blank = auto"
            aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput}
          />
        </div>
      )}
    </div>
  );
};
SelectionOptionsEditor.displayName = 'SelectionOptionsEditor';
