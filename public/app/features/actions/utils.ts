import {
  Action,
  ActionModel,
  AppEvents,
  DataContextScopedVar,
  DataFrame,
  DataLink,
  Field,
  FieldType,
  getFieldDataContextClone,
  HttpRequestMethod,
  InterpolateFunction,
  ScopedVars,
  textUtil,
  ValueLinkConfig,
} from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/core';

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

    let actionModel: ActionModel<Field> = { title: '', onClick: (e) => {} };

    actionModel = {
      title: replaceVariables(action.title || '', actionScopedVars),
      onClick: (evt: MouseEvent, origin: Field) => {
        buildActionOnClick(action, boundReplaceVariables);
      },
    };

    return actionModel;
  });

  return actionModels.filter((action): action is ActionModel => !!action);
};

/** @internal */
const buildActionOnClick = (action: Action, replaceVariables: InterpolateFunction) => {
  try {
    const url = new URL(replaceVariables(getUrl(action.options.url)));
    const data = getRequestBody(action, replaceVariables);

    const requestHeaders: HeadersInit = [];
    let request: BackendSrvRequest = {
      url: url.toString(),
      method: action.options.method,
      data: data,
      headers: requestHeaders,
    };

    if (action.options.headers) {
      action.options.headers.forEach((param) => {
        requestHeaders.push([replaceVariables(param[0]), replaceVariables(param[1])]);
      });
    }

    if (action.options.queryParams) {
      action.options.queryParams?.forEach((param) => {
        url.searchParams.append(replaceVariables(param[0]), replaceVariables(param[1]));
      });

      request.url = url.toString();
    }

    if (action.options.method === HttpRequestMethod.POST || action.options.method === HttpRequestMethod.PUT) {
      if (!requestHeaders.hasOwnProperty('Content-Type')) {
        requestHeaders.push(['Content-Type', action.options.contentType!]);
      }
    }

    requestHeaders.push(['X-Grafana-Action', '1']);
    request.headers = requestHeaders;

    getBackendSrv()
      .fetch(request)
      .subscribe({
        error: (error) => {
          appEvents.emit(AppEvents.alertError, ['An error has occurred. Check console output for more details.']);
        },
        complete: () => {
          appEvents.emit(AppEvents.alertSuccess, ['API call was successful']);
        },
      });
  } catch (error) {
    appEvents.emit(AppEvents.alertError, ['An error has occurred. Check console output for more details.']);
    return;
  }
};

/** @internal */
const getRequestBody = (api: Action, replaceVariables: InterpolateFunction) => {
  let requestBody: string | undefined = api.options.body ? replaceVariables(api.options.body) : '{}';
  if (api.options.method === HttpRequestMethod.GET) {
    requestBody = undefined;
  }

  return requestBody;
};

// @TODO update return type
export const getActionsDefaultField = (dataLinks: DataLink[] = [], actions: Action[] = []) => {
  return {
    name: 'Default field',
    type: FieldType.string,
    config: { links: dataLinks, actions: actions },
    values: [],
  };
};

const getUrl = (endpoint: string) => {
  const isRelativeUrl = endpoint.startsWith('/');
  if (isRelativeUrl) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sanitizedRelativeURL = textUtil.sanitizeUrl(endpoint) as RelativeUrl;
    endpoint = createAbsoluteUrl(sanitizedRelativeURL, []);
  }

  return endpoint;
};
