import React, { CSSProperties, FunctionComponent, PropsWithChildren, ReactElement, useMemo } from 'react';
import { useSelector } from 'react-redux';

import { GrafanaThemeType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Tooltip } from '@grafana/ui';
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
  const { FNDashboard, mode, theme } = useSelector<StoreState, FnGlobalState>((state) => state.fnGlobalState);

  const changeLabelStyle = useMemo(() => {
    if (!FNDashboard) {
      return {};
    }

    /**
     * TODO:
     * The below ts-ignores result from the fact that we expect MuiTheme in Grafana
     * Let's pass GrafanaTheme
     */
    // @ts-ignore
    const color = theme?.palette?.text?.primary;
    // @ts-ignore
    const lightBackgroundColor = theme?.palette?.grey;
    // @ts-ignore
    const darkBackgroundColor = theme?.palette?.background?.default;

    const commonStyles: CSSProperties = {
      ...COMMON_PICKER_LABEL_STYLE,
      ...(color ? { color } : {}),
    };

    const backgroundColor = mode === GrafanaThemeType.Light ? lightBackgroundColor : darkBackgroundColor;
    const createLabelTheme: CSSProperties = backgroundColor ? { backgroundColor } : {};

    return { ...createLabelTheme, ...commonStyles };
  }, [FNDashboard, mode, theme]);

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
          style={FNDashboard ? changeLabelStyle : {}}
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
      style={FNDashboard ? changeLabelStyle : {}}
      data-testid={selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName)}
      htmlFor={elementId}
    >
      {fnLabelOrName}
    </label>
  );
}
