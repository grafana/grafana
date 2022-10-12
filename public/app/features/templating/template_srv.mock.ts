import { ScopedVars, TimeRange, TypedVariableModel } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { variableRegex } from '../variables/utils';

/**
 * Mock for TemplateSrv where you can just supply map of key and values and it will do the interpolation based on that.
 * For simple tests whether you your data source for example calls correct replacing code.
 *
 * This is implementing TemplateSrv interface but that is not enough in most cases. Datasources require some additional
 * methods and usually require TemplateSrv class directly instead of just the interface which probably should be fixed
 * later on.
 */
export class TemplateSrvMock implements TemplateSrv {
  private regex = variableRegex;
  constructor(private variables: Record<string, string>) {}

  getVariables(): TypedVariableModel[] {
    return Object.keys(this.variables).map((key) => {
      return {
        type: 'custom',
        name: key,
        label: key,
      };
      // TODO: we remove this type assertion in a later PR
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    }) as TypedVariableModel[];
  }

  replace(target?: string, scopedVars?: ScopedVars, format?: string | Function): string {
    if (!target) {
      return target ?? '';
    }

    this.regex.lastIndex = 0;

    return target.replace(this.regex, (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
      const variableName = var1 || var2 || var3;
      return this.variables[variableName];
    });
  }

  getVariableName(expression: string) {
    this.regex.lastIndex = 0;
    const match = this.regex.exec(expression);
    if (!match) {
      return null;
    }
    return match.slice(1).find((match) => match !== undefined);
  }

  containsTemplate(target: string | undefined): boolean {
    if (!target) {
      return false;
    }

    this.regex.lastIndex = 0;
    const match = this.regex.exec(target);
    return match !== null;
  }

  updateTimeRange(timeRange: TimeRange) {}
}
