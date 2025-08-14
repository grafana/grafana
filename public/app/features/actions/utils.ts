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
  ProxyOptions,
  ScopedVars,
  textUtil,
  ValueLinkConfig,
} from '@grafana/data';
import { BackendSrvRequest, config as grafanaConfig, getBackendSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/core';

import { HttpRequestMethod } from '../../plugins/panel/canvas/panelcfg.gen';
import { createAbsoluteUrl, RelativeUrl } from '../alerting/unified/utils/url';
import { getNextRequestId } from '../query/state/PanelQueryRunner';

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

    const actionModel: ActionModel<Field> = {
      title: replaceVariables(action.title, actionScopedVars),
      confirmation: (actionVars?: ActionVariableInput) =>
        genReplaceActionVars(
          boundReplaceVariables,
          action,
          actionVars
        )(action.confirmation || `Are you sure you want to ${action.title}?`),
      onClick: (evt: MouseEvent, origin: Field, actionVars?: ActionVariableInput) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        let request = {} as BackendSrvRequest;
        if (grafanaConfig.featureToggles.vizActionsAuth && action.type === ActionType.Proxy) {
          request = buildActionProxyRequest(action, genReplaceActionVars(boundReplaceVariables, action, actionVars));
        } else if (action.type === ActionType.Fetch) {
          request = buildActionRequest(action, genReplaceActionVars(boundReplaceVariables, action, actionVars));
        }

        try {
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
  const data = getData(action, replaceVariables);

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
  const config = action[action.type];
  if (!config) {
    return '{}';
  }

  let data: string | undefined = config.body ? replaceVariables(config.body) : '{}';
  if (config.method === HttpRequestMethod.GET) {
    data = undefined;
  }

  return data;
};

export enum SupportedDataSourceType {
  Infinity = 'yesoreyeram-infinity-datasource',
}

/** @internal */
interface DatasourceRequestBuilder {
  buildRequest(
    proxyConfig: ProxyOptions,
    url: URL,
    data: string | undefined,
    headers: Array<[string, string]>,
    queryParams: Array<[string, string]>,
    contentType: string
  ): BackendSrvRequest;
}

/** @internal */
class InfinityRequestBuilder implements DatasourceRequestBuilder {
  buildRequest(
    proxyConfig: ProxyOptions,
    url: URL,
    data: string | undefined,
    headers: Array<[string, string]>,
    queryParams: Array<[string, string]>,
    contentType: string
  ): BackendSrvRequest {
    const requestId = getNextRequestId();
    const infinityUrl = `api/ds/query?ds_type=${proxyConfig.datasourceType}&requestId=${requestId}`;

    const requestHeaders: any = [];
    headers.forEach(([name, value]) => {
      requestHeaders.push({ key: name, value: value });
    });

    // Infinity needs [string, string] to {key: string, value: string}
    const requestQueryParams: any = [];
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
              type: proxyConfig.datasourceType,
              uid: proxyConfig.datasourceUid,
            },
            type: 'json',
            source: 'url',
            format: 'as-is',
            url,
            url_options: infinityUrlOptions,
          },
        ],
        from: Date.now().toString(),
        to: Date.now().toString(),
      },
    };
  }
}

/** @internal */
const getDatasourceRequestBuilder = (datasourceType: string): DatasourceRequestBuilder => {
  switch (datasourceType) {
    case SupportedDataSourceType.Infinity:
      return new InfinityRequestBuilder();
    default:
      throw new Error(`Unsupported datasource type: ${datasourceType}`);
  }
};

/** @internal */
export const buildActionProxyRequest = (action: Action, replaceVariables: InterpolateFunction) => {
  const { config, url, data, processedHeaders, processedQueryParams, contentType } = processActionConfig(
    action,
    replaceVariables
  );

  // @TODO
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const proxyConfig = config as ProxyOptions;
  if (!proxyConfig.datasourceUid) {
    throw new Error('Proxy action requires a datasource to be configured');
  }

  const requestBuilder = getDatasourceRequestBuilder(proxyConfig.datasourceType);
  return requestBuilder.buildRequest(proxyConfig, url, data, processedHeaders, processedQueryParams, contentType);
};
