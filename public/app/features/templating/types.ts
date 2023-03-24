import { ScopedVars } from '@grafana/data';
import { VariableCustomFormatterFn } from '@grafana/scenes';

export interface MacroHandler {
  (
    variableName: string,
    scopedVars: ScopedVars | undefined,
    fieldPath: string | undefined,
    format: string | VariableCustomFormatterFn | undefined
  ): string;
}
