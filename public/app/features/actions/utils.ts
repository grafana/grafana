import {
  Action,
  ActionModel,
  ActionType,
  ActionVariableInput,
  AppEvents,
  DataContextScopedVar,
  DataFrame,
  DataLink,
  Field,
  FieldType,
  getFieldDataContextClone,
  InterpolateFunction,
  InfinityOptions,
  ScopedVars,
  textUtil,
  ValueLinkConfig,
} from '@grafana/data';
import { BackendSrvRequest, config as grafanaConfig, getBackendSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/core';

import { HttpRequestMethod } from '../../plugins/panel/canvas/panelcfg.gen';
import { createAbsoluteUrl, RelativeUrl } from '../alerting/unified/utils/url';
import { getTimeSrv } from '../dashboard/services/TimeSrv';
import { getNextRequestId } from '../query/state/PanelQueryRunner';

import { reportActionTrigger, ActionContext } from './analytics';

/** @internal */
export const isInfinityActionWithAuth = (action: Action): boolean => {
  return (grafanaConfig.featureToggles.vizActionsAuth ?? false) && action.type === ActionType.Infinity;
};

/** @internal */
export const genReplaceActionVars = (
  boundReplaceVariables: InterpolateFunction,
  action: Action,
  actionVars?: ActionVariableInput
): InterpolateFunction => {
  return (value, scopedVars, format) => {
    if (action.variables && actionVars) {
      value = value.replace(/\$\w+/g, (matched) => {
        const name = matched.slice(1);

        if (action.variables!.some((action) => action.key === name) && actionVars[name] != null) {
          return actionVars[name];
        }

        return matched;
      });
    }

    return boundReplaceVariables(value, scopedVars, format);
  };
};

/** @internal */
export const getActions = (
  frame: DataFrame,
  field: Field,
  fieldScopedVars: ScopedVars,
  replaceVariables: InterpolateFunction,
  actions: Action[],
  config: ValueLinkConfig,
  context?: ActionContext
): Array<ActionModel<Field>> => {
  if (!actions || actions.length === 0) {
    return [];
  }

  const actionModels = actions
    .filter((action) => {
      return action.type === ActionType.Fetch || isInfinityActionWithAuth(action);
    })
    .map((action: Action) => {
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

      const actionModel: ActionModel<Field> = {
        title: replaceVariables(action.title, actionScopedVars),
        type: action.type,
        confirmation: (actionVars?: ActionVariableInput) =>
          genReplaceActionVars(
            boundReplaceVariables,
            action,
            actionVars
          )(action.confirmation || `Are you sure you want to ${action.title}?`),
        onClick: (evt: MouseEvent, origin: Field, actionVars?: ActionVariableInput) => {
          if (context?.visualizationType) {
            reportActionTrigger(action.type, action.oneClick ?? false, context);
          }

          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          let request = {} as BackendSrvRequest;
          if (isInfinityActionWithAuth(action)) {
            request = buildActionProxyRequest(action, genReplaceActionVars(boundReplaceVariables, action, actionVars));
          } else if (action.type === ActionType.Fetch) {
            request = buildActionRequest(action, genReplaceActionVars(boundReplaceVariables, action, actionVars));
          }

          try {
            getBackendSrv()
              .fetch(request)
              .subscribe({
                error: (error) => {
                  appEvents.emit(AppEvents.alertError, [
                    'An error has occurred. Check console output for more details.',
                  ]);
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

/** @internal */
const processActionConfig = (action: Action, replaceVariables: InterpolateFunction) => {
  const config = action[action.type];
  if (!config) {
    throw new Error('Action does not have the correct configuration');
  }

  const url = new URL(getUrl(replaceVariables(config.url)));
  const data = config.method === HttpRequestMethod.GET ? undefined : config.body ? replaceVariables(config.body) : '{}';

  const processedHeaders: Array<[string, string]> = [];
  const processedQueryParams: Array<[string, string]> = [];
  let contentType = 'application/json';

  if (config.headers) {
    config.headers.forEach(([name, value]) => {
      const processedName = replaceVariables(name);
      const processedValue = replaceVariables(value);
      processedHeaders.push([processedName, processedValue]);

      if (processedName.toLowerCase() === 'content-type') {
        contentType = processedValue;
      }
    });
  }

  if (config.queryParams) {
    config.queryParams.forEach(([name, value]) => {
      processedQueryParams.push([replaceVariables(name), replaceVariables(value)]);
    });
  }

  return {
    config,
    url,
    data,
    processedHeaders,
    processedQueryParams,
    contentType,
  };
};

/** @internal */
export const buildActionRequest = (action: Action, replaceVariables: InterpolateFunction) => {
  const { config, url, data, processedHeaders, processedQueryParams } = processActionConfig(action, replaceVariables);

  const requestHeaders: Record<string, string> = {};

  processedHeaders.forEach(([name, value]) => {
    requestHeaders[name] = value;
  });

  processedQueryParams.forEach(([name, value]) => {
    url.searchParams.append(name, value);
  });

  requestHeaders['X-Grafana-Action'] = '1';

  const request: BackendSrvRequest = {
    url: url.toString(),
    method: config.method,
    data,
    headers: requestHeaders,
  };

  return request;
};

/** @internal */
export const getActionsDefaultField = (dataLinks: DataLink[] = [], actions: Action[] = []): Field => {
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
interface KeyValuePair {
  key: string;
  value: string;
}

export const INFINITY_DATASOURCE_TYPE = 'yesoreyeram-infinity-datasource';

/** @internal */
class InfinityRequestBuilder {
  buildRequest(
    proxyConfig: InfinityOptions,
    url: URL,
    data: string | undefined,
    headers: Array<[string, string]>,
    queryParams: Array<[string, string]>,
    contentType: string
  ): BackendSrvRequest {
    const requestId = getNextRequestId();
    const infinityUrl = `api/ds/query?ds_type=${INFINITY_DATASOURCE_TYPE}&requestId=${requestId}`;
    const timeRange = getTimeSrv().timeRange();

    const requestHeaders: KeyValuePair[] = [];
    headers.forEach(([name, value]) => {
      requestHeaders.push({ key: name, value: value });
    });

    // Infinity needs [string, string] to {key: string, value: string}
    const requestQueryParams: KeyValuePair[] = [];
    queryParams.forEach(([name, value]) => {
      requestQueryParams.push({ key: name, value: value });
    });

    const infinityUrlOptions = {
      method: proxyConfig.method,
      data,
      headers: requestHeaders,
      params: requestQueryParams,
      body_type: 'raw',
      body_content_type: contentType,
    };

    return {
      url: infinityUrl,
      method: HttpRequestMethod.POST,
      data: {
        queries: [
          {
            refId: 'A',
            datasource: {
              type: INFINITY_DATASOURCE_TYPE,
              uid: proxyConfig.datasourceUid,
            },
            type: 'json',
            source: 'url',
            format: 'as-is',
            url,
            url_options: infinityUrlOptions,
          },
        ],
        from: timeRange.from.valueOf().toString(),
        to: timeRange.to.valueOf().toString(),
      },
    };
  }
}

/** @internal */
export const buildActionProxyRequest = (action: Action, replaceVariables: InterpolateFunction) => {
  const { config, url, data, processedHeaders, processedQueryParams, contentType } = processActionConfig(
    action,
    replaceVariables
  );

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const infinityConfig = config as InfinityOptions;
  if (!infinityConfig.datasourceUid) {
    throw new Error('Datasource not configured for Infinity action');
  }

  const requestBuilder = new InfinityRequestBuilder();
  return requestBuilder.buildRequest(infinityConfig, url, data, processedHeaders, processedQueryParams, contentType);
};
