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
  constructor(private variables: Array<Partial<TypedVariableModel>>) {}

  getVariables(): TypedVariableModel[] {
    if (!this.variables) {
      return [];
    }

    return this.variables.reduce(
      (acc, variable) => {
        const commonProps = {
          type: variable.type,
          name: variable.name,
          label: variable.label,
        };
        if (variable.type === 'datasource') {
          acc.push({
            ...commonProps,
            current: {
              text: variable.current?.text,
              value: variable.current?.value,
            },
            options: variable.options,
            multi: variable.multi,
            includeAll: variable.includeAll,
          });
        } else {
          acc.push({
            ...commonProps,
          });
        }
        return acc;
      },
      [] as unknown as Array<Partial<TypedVariableModel>>
    ) as TypedVariableModel[];
  }

  replace(target?: string, scopedVars?: ScopedVars, format?: string | Function): string {
    if (!target) {
      return target ?? '';
    }

    this.regex.lastIndex = 0;

    return target.replace(this.regex, (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
      const variableName = var1 || var2 || var3;
      if (!variableName) {
        return this.variables.find((v) => v.name === variableName);
      } else {
        return variableName;
      }
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

  getAdhocFilters(dsName: string) {
    return [{ key: 'key', operator: '=', value: 'a' }];
  }
}
