import React, { FunctionComponent, PropsWithChildren, ReactElement, useMemo } from 'react';
import { useSelector } from 'react-redux';

import { selectors } from '@grafana/e2e-selectors';
import { Tooltip } from '@grafana/ui';
import { FnGlobalState } from 'app/core/reducers/fn-slice';
import type { StoreState } from 'app/types';

import { GrafanaThemeType } from '../../../../../packages/grafana-data/src/types/theme';
import { variableAdapters } from '../adapters';
import { VariableHide, VariableModel } from '../types';

interface Props {
  variable: VariableModel;
  readOnly?: boolean;
}

const changeLabelStyle = (theme: GrafanaThemeType) => {
  if (theme === GrafanaThemeType.Light) {
    return { color: '#2D333E' };
  }
  return { color: '#fff' };
};

export const PickerRenderer: FunctionComponent<Props> = (props) => {
  const PickerToRender = useMemo(() => variableAdapters.get(props.variable.type).picker, [props.variable]);

  if (!props.variable) {
    return <div>Couldn&apos;t load variable</div>;
  }

  return (
    <div className="gf-form">
      <PickerLabel variable={props.variable} />
      {props.variable.hide !== VariableHide.hideVariable && PickerToRender && (
        <PickerToRender variable={props.variable} readOnly={props.readOnly ?? false} />
      )}
    </div>
  );
};

function PickerLabel({ variable }: PropsWithChildren<Props>): ReactElement | null {
  const labelOrName = useMemo(() => variable.label || variable.name, [variable]);
  const { FNDashboard, theme } = useSelector<StoreState, FnGlobalState>((state) => state.fnGlobalState);
  if (variable.hide !== VariableHide.dontHide) {
    return null;
  }

  const elementId = `var-${variable.id}`;
  if (variable.description) {
    return (
      <Tooltip content={variable.description} placement={'bottom'}>
        <label
          className="gf-form-label gf-form-label--variable"
          style={FNDashboard ? changeLabelStyle(theme) : {}}
          data-testid={selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName)}
          htmlFor={elementId}
        >
          {labelOrName}
        </label>
      </Tooltip>
    );
  }

  return (
    <label
      className="gf-form-label gf-form-label--variable"
      style={FNDashboard ? changeLabelStyle(theme) : {}}
      data-testid={selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName)}
      htmlFor={elementId}
    >
      {labelOrName}
    </label>
  );
}
