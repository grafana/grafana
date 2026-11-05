import {
  CustomVariable,
  sceneGraph,
  SceneVariableSet,
  SceneVariableValueChangedEvent,
  sceneUtils,
  SwitchVariable,
  type SceneObject,
  type SceneVariable,
  type SceneVariables,
  type VizPanel,
} from '@grafana/scenes';
import {
  type NewVarMappingVariable,
  type VarMappingVariable,
  type VarMappingVariableSource,
  type VarMappingVariableValue,
} from 'app/core/components/OptionsUI/varMappingVariables';

import { getDashboardSceneFor } from '../utils/utils';

/**
 * The variables a panel's `varMappings` editors pick from: those of every variable set from the
 * panel up to the dashboard, the closest first, which is how the panel resolves them. New variables
 * go into the dashboard's own variable set, not a section's.
 */
export function getVarMappingVariableSource(panel: VizPanel): VarMappingVariableSource {
  const dashboard = getDashboardSceneFor(panel);
  const getDashboardSet = () => {
    const set = dashboard.state.$variables;
    return set instanceof SceneVariableSet ? set : undefined;
  };

  return {
    getVariables: () => {
      const seen = new Set<string>();
      return (
        getVariableSets(panel)
          .flatMap((set) => set.state.variables)
          // A closer variable shadows one with the same name further up. System variables such as
          // scopes aren't values a panel option can take.
          .filter((variable) => {
            const isShown = variable.state.type !== 'system' && !seen.has(variable.state.name);
            seen.add(variable.state.name);
            return isShown;
          })
          .map(toVarMappingVariable)
      );
    },
    interpolate: panel.interpolate,
    subscribe: (onChange) => {
      const valueSub = dashboard.subscribeToEvent(SceneVariableValueChangedEvent, onChange);
      const setSubs = getVariableSets(panel).map((set) =>
        set.subscribeToState((state, prev) => {
          if (state.variables !== prev.variables) {
            onChange();
          }
        })
      );
      return () => {
        valueSub.unsubscribe();
        setSubs.forEach((sub) => sub.unsubscribe());
      };
    },
    createVariable: (variable) => {
      // The panel already resolves the closest variable with this name, from its own set or any above
      if (sceneGraph.lookupVariable(variable.name, panel)) {
        return true;
      }
      const set = getDashboardSet();
      if (!set) {
        return false;
      }
      set.setState({ variables: [...set.state.variables, createSceneVariable(variable)] });
      return true;
    },
  };
}

/** The variable sets from the object up to the dashboard, the closest first, as `lookupVariable` walks them */
function getVariableSets(sceneObject: SceneObject): SceneVariables[] {
  const sets: SceneVariables[] = [];
  for (let current: SceneObject | undefined = sceneObject; current; current = current.parent) {
    if (current.state.$variables) {
      sets.push(current.state.$variables);
    }
  }
  return sets;
}

function toVarMappingVariable(variable: SceneVariable): VarMappingVariable {
  const current = variable.getValueText?.() ?? variable.getValue();
  return {
    name: variable.state.name,
    current: current === undefined || current === null ? undefined : String(current),
    values: getKnownValues(variable),
  };
}

/** Values known without running a query; a custom query that references other variables isn't */
function getKnownValues(variable: SceneVariable): VarMappingVariableValue[] | undefined {
  if (sceneUtils.isSwitchVariable(variable)) {
    return [
      { value: variable.state.enabledValue, label: variable.state.enabledValue },
      { value: variable.state.disabledValue, label: variable.state.disabledValue },
    ];
  }
  if (sceneUtils.isConstantVariable(variable)) {
    return [{ value: String(variable.state.value), label: String(variable.state.value) }];
  }
  if (sceneUtils.isCustomVariable(variable) && !variable.variableDependency?.getNames().size) {
    return variable.state.options.map((option) => ({ value: String(option.value), label: option.label }));
  }
  return undefined;
}

function createSceneVariable({ name, type, values, current }: NewVarMappingVariable): SceneVariable {
  if (type === 'switch') {
    return new SwitchVariable({ name, value: current, enabledValue: 'true', disabledValue: 'false' });
  }

  const currentOption = values.find((option) => option.value === current);
  return new CustomVariable({
    name,
    query: values.map(toCustomQueryEntry).join(','),
    value: current,
    text: currentOption?.label ?? current,
  });
}

/** `label : value` entry of a custom variable query, with commas escaped */
function toCustomQueryEntry({ value, label }: VarMappingVariableValue): string {
  const escape = (text: string) => text.replace(/,/g, '\\,');
  return label === value ? escape(value) : `${escape(label)} : ${escape(value)}`;
}
