import { Set } from 'immutable';
import React, { FunctionComponent, useEffect, useState } from 'react';

import { VariableWithOptions } from '@grafana/data';
import { SelectableValue } from '@grafana/data/src';
import { selectors } from '@grafana/e2e-selectors';

import { PickerRenderer } from '../../../variables/pickers/PickerRenderer';
import { VariableHide, VariableModel } from '../../../variables/types';

import { ExpandableItem } from './ExpandableItem';

interface Props {
  variables: VariableModel[];
  readOnly?: boolean;
}

export const SubMenuItems: FunctionComponent<Props> = ({ variables, readOnly }) => {
  const [visibleVariables, setVisibleVariables] = useState<VariableModel[]>([]);
  const [expandedVariables, setExpandedVariables] = useState<Set<string>>(
    Set.of(
      ...variables
        .filter((v) => !!(v as VariableWithOptions).current?.value) // eslint-disable-line
        .map((v) => v.name)
    )
  );

  useEffect(() => {
    setVisibleVariables(
      variables.filter(
        (state) =>
          (state.hide === VariableHide.hideExpandable && expandedVariables.has(state.name)) ||
          (state.hide !== VariableHide.hideVariable && state.hide !== VariableHide.hideExpandable)
      )
    );
  }, [expandedVariables, variables]);

  const expandableVariables = variables.filter((state) => state.hide === VariableHide.hideExpandable);

  if (visibleVariables.length + expandableVariables.length === 0) {
    return null;
  }

  const loadExpandable = (): Promise<Array<SelectableValue<string>>> =>
    Promise.resolve(
      expandableVariables.filter((v) => !expandedVariables.has(v.name)).map((v) => ({ label: v.label, value: v.name }))
    );

  return (
    <>
      {visibleVariables.map((variable) => {
        return (
          <div
            key={variable.id}
            className="submenu-item gf-form-inline"
            data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}
          >
            <PickerRenderer variable={variable} readOnly={readOnly} />
          </div>
        );
      })}
      {expandableVariables.length !== 0 && (
        <ExpandableItem
          onChange={(item) => setExpandedVariables((s) => s.add(item.value!))}
          loadOptions={loadExpandable}
        />
      )}
    </>
  );
};
