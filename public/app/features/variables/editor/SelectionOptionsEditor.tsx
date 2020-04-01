import React, { FunctionComponent, useCallback } from 'react';
import { Switch } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

import { VariableWithMultiSupport } from '../../templating/types';
import { VariableEditorProps } from './types';

export interface SelectionOptionsEditorProps<Model extends VariableWithMultiSupport = VariableWithMultiSupport>
  extends VariableEditorProps<Model> {}

export const SelectionOptionsEditor: FunctionComponent<SelectionOptionsEditorProps> = props => {
  const onMultiChanged = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      props.onPropChange({ propName: 'multi', propValue: event.target.checked });
    },
    [props.onPropChange]
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
        <div aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.selectionOptionsMultiSwitch}>
          <Switch
            label="Multi-value"
            labelClass="width-10"
            checked={props.variable.multi}
            onChange={onMultiChanged}
            tooltip={'Enables multiple values to be selected at the same time'}
          />
        </div>
        <div
          aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.selectionOptionsIncludeAllSwitch}
        >
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
            aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.selectionOptionsCustomAllInput}
          />
        </div>
      )}
    </div>
  );
};
SelectionOptionsEditor.displayName = 'SelectionOptionsEditor';
