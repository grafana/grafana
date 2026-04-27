import { type SceneVariable, SceneVariableSet } from '@grafana/scenes';

export type VariableSectionType = 'dashboard' | 'row' | 'tab';

export function getVariableSectionType(variable: SceneVariable): VariableSectionType {
  const set = variable.parent;
  if (!(set instanceof SceneVariableSet)) {
    return 'dashboard';
  }

  const sectionType = hasSectionType(set.parent) ? set.parent.sectionType : undefined;
  return sectionType === 'row' || sectionType === 'tab' ? sectionType : 'dashboard';
}

function hasSectionType(value: unknown): value is { sectionType: unknown } {
  return typeof value === 'object' && value !== null && 'sectionType' in value;
}
