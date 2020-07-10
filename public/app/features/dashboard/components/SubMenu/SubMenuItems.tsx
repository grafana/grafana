import React, { FunctionComponent, useEffect, useState } from 'react';
import { VariableHide, VariableModel } from '../../../variables/types';
import { selectors } from '@grafana/e2e-selectors';
import { PickerRenderer } from '../../../variables/pickers/PickerRenderer';

interface Props {
  variables: VariableModel[];
}

export const SubMenuItems: FunctionComponent<Props> = ({ variables }) => {
  const [visibleVariables, setVisibleVariables] = useState<VariableModel[]>([]);
  useEffect(() => {
    setVisibleVariables(variables.filter(state => state.hide !== VariableHide.hideVariable));
  }, [variables]);

  if (visibleVariables.length === 0) {
    return null;
  }

  return (
    <>
      {visibleVariables.map(variable => {
        return (
          <div
            key={variable.id}
            className="submenu-item gf-form-inline"
            aria-label={selectors.pages.Dashboard.SubMenu.submenuItem}
          >
            <PickerRenderer variable={variable} />
          </div>
        );
      })}
    </>
  );
};
