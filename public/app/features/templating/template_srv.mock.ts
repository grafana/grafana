import { ScopedVars, TimeRange, TypedVariableModel, VariableOption } from '@grafana/data';
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
  constructor(private variables: TypedVariableModel[]) {}

  getVariables(): TypedVariableModel[] {
    if (!this.variables) {
      return [];
    }

    return this.variables.reduce((acc: TypedVariableModel[], variable) => {
      const commonProps = {
        type: variable.type ?? 'custom',
        name: variable.name ?? 'test',
        label: variable.label ?? 'test',
      };
      if (variable.type === 'datasource') {
        acc.push({
          ...commonProps,
          current: {
            text: variable.current?.text,
            value: variable.current?.value,
          } as VariableOption,
          options: variable.options ?? [],
          multi: variable.multi ?? false,
          includeAll: variable.includeAll ?? false,
        } as TypedVariableModel);
      } else {
        acc.push({
          ...commonProps,
        } as TypedVariableModel);
      }
      return acc as TypedVariableModel[];
    }, []);
  }

  replace(target?: string, scopedVars?: ScopedVars, format?: string | Function): string {
    if (!target) {
      return target ?? '';
    }

    this.regex.lastIndex = 0;

    return target.replace(this.regex, (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
      return var1 || var2 || var3;
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
