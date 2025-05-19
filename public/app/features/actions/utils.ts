import {
  Action,
  ActionModel,
  ActionVariableInput,
  AppEvents,
  DataContextScopedVar,
  DataFrame,
  DataLink,
  Field,
  FieldType,
  getFieldDataContextClone,
  InterpolateFunction,
  ScopedVars,
  textUtil,
  ValueLinkConfig,
} from '@grafana/data';
import { BackendSrvRequest, config as grafanaConfig, getBackendSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/core';

import { HttpRequestMethod } from '../../plugins/panel/canvas/panelcfg.gen';
import { createAbsoluteUrl, RelativeUrl } from '../alerting/unified/utils/url';

/** @internal */
export const getActions = (
  frame: DataFrame,
  field: Field,
  fieldScopedVars: ScopedVars,
  replaceVariables: InterpolateFunction,
  actions: Action[],
  config: ValueLinkConfig
): Array<ActionModel<Field>> => {
  if (!actions || actions.length === 0) {
    return [];
  }

  const actionModels = actions.map((action: Action) => {
    const dataContext: DataContextScopedVar = getFieldDataContextClone(frame, field, fieldScopedVars);
    const actionScopedVars = {
      ...fieldScopedVars,
      __dataContext: dataContext,
    };

    const boundReplaceVariables: InterpolateFunction = (value, scopedVars, format) => {
      return replaceVariables(value, { ...actionScopedVars, ...scopedVars }, format);
    };

    // We are not displaying reduction result
    if (config.valueRowIndex !== undefined && !isNaN(config.valueRowIndex)) {
      dataContext.value.rowIndex = config.valueRowIndex;
    } else {
      dataContext.value.calculatedValue = config.calculatedValue;
    }

    const title = replaceVariables(action.title, actionScopedVars);
    const confirmation = replaceVariables(
      action.confirmation || `Are you sure you want to ${action.title}?`,
      actionScopedVars
    );

    const actionModel: ActionModel<Field> = {
      title,
      confirmation,
      onClick: (evt: MouseEvent, origin: Field, actionVars: ActionVariableInput | undefined) => {
        let interpolatedAction = action;
        if (action.variables && actionVars) {
          interpolatedAction = interpolateActionVariables(action, actionVars);
        }
        buildActionOnClick(interpolatedAction, boundReplaceVariables);
      },
      oneClick: action.oneClick ?? false,
      style: {
        backgroundColor: action.style?.backgroundColor ?? grafanaConfig.theme2.colors.secondary.main,
      },
      variables: action.variables,
    };

    return actionModel;
  });

  return actionModels.filter((action): action is ActionModel => !!action);
};

const interpolateActionVariables = (action: Action, actionVars: ActionVariableInput): Action => {
  if (!action.variables || !actionVars || !action.fetch) {
    return action;
  }

  const actionCopy = JSON.parse(JSON.stringify(action));
  for (const variable of action.variables) {
    const value = actionVars[variable.key];
    if (!value) {
      continue;
    }

    const variableKey = '$' + variable.key;

    if (actionCopy.fetch) {
      // URL
      const urlRegex = new RegExp('\\${{' + variable.key + '}}', 'g');
      actionCopy.fetch.url = actionCopy.fetch.url.replace(urlRegex, value);

      if (actionCopy.fetch.body) {
        try {
          const parsedBody: object = JSON.parse(actionCopy.fetch.body);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const replaceValues = (actionBody: any): Action => {
            if (typeof actionBody !== 'object' || actionBody === null) {
              return actionBody;
            }

            const result = { ...actionBody };
            for (const [key, val] of Object.entries(result)) {
              if (typeof val === 'string') {
                if (val === variableKey) {
                  result[key] = value;
                }
              } else if (typeof val === 'object' && val !== null) {
                result[key] = replaceValues(val);
              }
            }
            return result;
          };

          actionCopy.fetch.body = JSON.stringify(replaceValues(parsedBody), null, 2);
        } catch (e) {
          console.error('Error interpolating action body:', e);
        }
      }

      if (Array.isArray(actionCopy.fetch.queryParams)) {
        actionCopy.fetch.queryParams = actionCopy.fetch.queryParams.map(([key, val]: [string, string]) => {
          if (val === variableKey) {
            return [key, value];
          }
          return [key, val];
        });
      }

      if (Array.isArray(actionCopy.fetch.headers)) {
        actionCopy.fetch.headers = actionCopy.fetch.headers.map(([key, val]: [string, string]) => {
          if (val === variableKey) {
            return [key, value];
          }
          return [key, val];
        });
      }
    }
  }

  return actionCopy;
};

/** @internal */
const buildActionOnClick = (action: Action, replaceVariables: InterpolateFunction) => {
  try {
    const url = new URL(getUrl(replaceVariables(action.fetch.url)));

    const requestHeaders: Record<string, string> = {};

    let request: BackendSrvRequest = {
      url: url.toString(),
      method: action.fetch.method,
      data: getData(action, replaceVariables),
      headers: requestHeaders,
    };

    if (action.fetch.headers) {
      action.fetch.headers.forEach(([name, value]) => {
        requestHeaders[replaceVariables(name)] = replaceVariables(value);
      });
    }

    if (action.fetch.queryParams) {
      action.fetch.queryParams?.forEach(([name, value]) => {
        url.searchParams.append(replaceVariables(name), replaceVariables(value));
      });

      request.url = url.toString();
    }

    requestHeaders['X-Grafana-Action'] = '1';
    request.headers = requestHeaders;

    getBackendSrv()
      .fetch(request)
      .subscribe({
        error: (error) => {
          appEvents.emit(AppEvents.alertError, ['An error has occurred. Check console output for more details.']);
          console.error(error);
        },
        complete: () => {
          appEvents.emit(AppEvents.alertSuccess, ['API call was successful']);
        },
      });
  } catch (error) {
    appEvents.emit(AppEvents.alertError, ['An error has occurred. Check console output for more details.']);
    console.error(error);
    return;
  }
};

/** @internal */
// @TODO update return type
export const getActionsDefaultField = (dataLinks: DataLink[] = [], actions: Action[] = []) => {
  return {
    name: 'Default field',
    type: FieldType.string,
    config: { links: dataLinks, actions: actions },
    values: [],
  };
};

/** @internal */
const getUrl = (endpoint: string) => {
  const isRelativeUrl = endpoint.startsWith('/');
  if (isRelativeUrl) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sanitizedRelativeURL = textUtil.sanitizeUrl(endpoint) as RelativeUrl;
    endpoint = createAbsoluteUrl(sanitizedRelativeURL, []);
  }

  return endpoint;
};

/** @internal */
const getData = (action: Action, replaceVariables: InterpolateFunction) => {
  let data: string | undefined = action.fetch.body ? replaceVariables(action.fetch.body) : '{}';
  if (action.fetch.method === HttpRequestMethod.GET) {
    data = undefined;
  }

  return data;
};
