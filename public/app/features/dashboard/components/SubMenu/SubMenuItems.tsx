import React, { FunctionComponent, useEffect, useState } from 'react';
import { VariableHide, VariableModel } from '../../../templating/variable';
import { e2e } from '@grafana/e2e';
import { PickerRenderer } from '../../../templating/pickers/PickerRenderer';

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
            key={variable.uuid}
            className="submenu-item gf-form-inline"
            aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItem}
          >
            <PickerRenderer variable={variable} />
          </div>
        );
      })}
    </>
  );
};
