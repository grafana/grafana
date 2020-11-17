import { VariableModel, ScopedVars } from '@grafana/data';

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
  getVariables(): VariableModel[];

  /**
   * Replace the values within the target string.  See also {@link InterpolateFunction}
   */
  replace(target?: string, scopedVars?: ScopedVars, format?: string | Function): string;
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
