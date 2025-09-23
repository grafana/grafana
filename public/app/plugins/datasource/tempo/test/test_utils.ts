import { TimeRange, ScopedVars } from '@grafana/data';
import { getTemplateSrv, setTemplateSrv } from '@grafana/runtime';

export const initTemplateSrv = (variables: Array<{ name: string }>, expectedValues: Record<string, string>) => {
  const replace = (target?: string, scopedVars?: ScopedVars, format?: string | Function): string => {
    if (!target) {
      return target ?? '';
    }

    const variableRegex = /\$(\w+)|\[\[(\w+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;
    variableRegex.lastIndex = 0;

    return target.replace(variableRegex, (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
      const variableName = var1 || var2 || var3;
      return expectedValues[variableName];
    });
  };

  setTemplateSrv({
    replace: replace,
    // @ts-ignore
    getVariables() {
      return variables;
    },
    containsTemplate() {
      return false;
    },
    updateTimeRange(timeRange: TimeRange) {},
  });
  return getTemplateSrv();
};
