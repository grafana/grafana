import React, { CSSProperties, FunctionComponent, PropsWithChildren, ReactElement, useMemo } from 'react';
import { useSelector } from 'react-redux';

import { selectors } from '@grafana/e2e-selectors';
import { Tooltip, useTheme2 } from '@grafana/ui';
import { FnGlobalState } from 'app/core/reducers/fn-slice';
import type { StoreState } from 'app/types';

import { variableAdapters } from '../adapters';
import { VariableHide, VariableModel } from '../types';

interface Props {
  variable: VariableModel;
  readOnly?: boolean;
}

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

const COMMON_PICKER_LABEL_STYLE: CSSProperties = {
  borderRadius: '4px',
  border: 'none',
  fontWeight: 600,
  fontSize: '12px',
};

function PickerLabel({ variable }: PropsWithChildren<Props>): ReactElement | null {
  const labelOrName = useMemo(() => variable.label || variable.name, [variable]);
  const { FNDashboard } = useSelector<StoreState, FnGlobalState>(({ fnGlobalState }) => fnGlobalState);
  const theme = useTheme2();

  if (variable.hide !== VariableHide.dontHide) {
    return null;
  }
  const fnLabelOrName = FNDashboard ? labelOrName.replace('druid', '') : labelOrName;

  const elementId = `var-${variable.id}`;
  if (variable.description) {
    return (
      <Tooltip content={variable.description} placement={'bottom'}>
        <label
          className="gf-form-label gf-form-label--variable"
          style={FNDashboard ? { ...COMMON_PICKER_LABEL_STYLE, color: theme.colors.text.secondary } : {}}
          data-testid={selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName)}
          htmlFor={elementId}
        >
          {fnLabelOrName}
        </label>
      </Tooltip>
    );
  }
  return (
    <label
      className="gf-form-label gf-form-label--variable"
      style={FNDashboard ? { ...COMMON_PICKER_LABEL_STYLE, color: theme.colors.text.secondary } : {}}
      data-testid={selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName)}
      htmlFor={elementId}
    >
      {fnLabelOrName}
    </label>
  );
}
