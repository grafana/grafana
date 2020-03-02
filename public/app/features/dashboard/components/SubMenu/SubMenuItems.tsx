import React, { FunctionComponent, useEffect, useState } from 'react';
import { VariableState } from '../../../templating/state/types';
import { VariableHide } from '../../../templating/variable';
import { e2e } from '@grafana/e2e';
import { VariablePicker } from '../../../templating/pickers/VariablePicker';

interface Props {
  variableStates: VariableState[];
}

export const SubMenuItems: FunctionComponent<Props> = ({ variableStates }) => {
  const [visibleVariableStates, setVisibleVariableStates] = useState([]);
  useEffect(() => {
    setVisibleVariableStates(variableStates.filter(state => state.variable.hide !== VariableHide.hideVariable));
  }, [variableStates]);

  if (visibleVariableStates.length === 0) {
    return null;
  }

  return (
    <>
      {visibleVariableStates.map(state => {
        return (
          <div
            key={state.variable.uuid}
            className="submenu-item gf-form-inline"
            aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItem}
          >
            <VariablePicker picker={state.picker} editor={state.editor} variable={state.variable} />
          </div>
        );
      })}
    </>
  );
};
