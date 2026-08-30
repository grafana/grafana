import { type ScopedVars } from '@grafana/data';
import { type VariableCustomFormatterFn } from '@grafana/scenes';

export interface MacroHandler {
  (
    match: string,
    fieldPath: string | undefined,
    scopedVars: ScopedVars | undefined,
    format: string | VariableCustomFormatterFn | undefined
  ): string;
}
