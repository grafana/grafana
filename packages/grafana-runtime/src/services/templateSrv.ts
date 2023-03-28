import { ScopedVars, TimeRange, TypedVariableModel } from '@grafana/data';

/**
 * Can be used to gain more information about an interpolation operation
 */
export interface VariableInterpolation {
  /** The full matched expression including, example: ${varName.field:regex} */
  match: string;
  /** In the expression ${varName.field:regex} variableName is varName */
  variableName: string;
  /** In the expression ${varName.fields[0].name:regex} the fieldPath is fields[0].name */
  fieldPath?: string;
  /** In the expression ${varName:regex} the regex part is the format */
  format?: string;
  /** The formatted value of the variable expresion. Will equal match when variable not found or scopedVar was undefined or null **/
  value: string;
  // When value === match this will be true, meaning the variable was not found
  found?: boolean;
}

/**
 * Via the TemplateSrv consumers get access to all the available template variables
 * that can be used within the current active dashboard.
 *
 * For a more in-depth description visit: https://grafana.com/docs/grafana/latest/reference/templating
 * @public
 */
export interface TemplateSrv {
  /**
   * List the dashboard variables
   */
  getVariables(): TypedVariableModel[];

  /**
   * Replace the values within the target string.  See also {@link InterpolateFunction}
   *
   * Note: interpolations array is being mutated by replace function by adding information about variables that
   * have been interpolated during replacement. Variables that were specified in the target but not found in
   * the list of available variables are also added to the array. See {@link VariableInterpolation} for more details.
   *
   * @param {VariableInterpolation[]} interpolations an optional map that is updated with interpolated variables
   */
  replace(
    target?: string,
    scopedVars?: ScopedVars,
    format?: string | Function,
    interpolations?: VariableInterpolation[]
  ): string;

  /**
   * Checks if a target contains template variables.
   */
  containsTemplate(target?: string): boolean;

  /**
   * Update the current time range to be used when interpolating __from / __to variables.
   */
  updateTimeRange(timeRange: TimeRange): void;
}

let singletonInstance: TemplateSrv;

/**
 * Used during startup by Grafana to set the TemplateSrv so it is available
 * via the {@link getTemplateSrv} to the rest of the application.
 *
 * @internal
 */
export const setTemplateSrv = (instance: TemplateSrv) => {
  singletonInstance = instance;
};

/**
 * Used to retrieve the {@link TemplateSrv} that can be used to fetch available
 * template variables.
 *
 * @public
 */
export const getTemplateSrv = (): TemplateSrv => singletonInstance;
