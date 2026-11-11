import { type VariableSuggestion, VariableOrigin } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

export function getVariableSuggestions(): VariableSuggestion[] {
  return getTemplateSrv()
    .getVariables()
    .map((v) => ({ value: v.name, label: v.label || v.name, origin: VariableOrigin.Template }));
}
