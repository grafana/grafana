import { ScopedVars } from '@grafana/data';
import { VariableCustomFormatterFn } from '@grafana/scenes';

export interface MacroHandler {
  (
    variableName: string,
    scopedVars?: ScopedVars,
    fieldPath?: string,
    format?: string | VariableCustomFormatterFn
  ): string;
}
