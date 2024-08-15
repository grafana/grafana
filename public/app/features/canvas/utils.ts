import {
  Action,
  ActionModel,
  AppEvents,
  DataContextScopedVar,
  DataFrame,
  Field,
  getFieldDataContextClone,
  HttpRequestMethod,
  InterpolateFunction,
  ScopedVars,
  ValueLinkConfig,
} from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

import { appEvents } from '../../core/core';

export const getActionsSupplier =
  (
    frame: DataFrame,
    field: Field,
    fieldScopedVars: ScopedVars,
    replaceVariables: InterpolateFunction,
    actions: Action[]
  ) =>
  (config: ValueLinkConfig): Array<ActionModel<Field>> => {
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

      let actionModel: ActionModel<Field> = { title: '' };

      if (action.onClick) {
        actionModel = {
          title: replaceVariables(action.title || '', actionScopedVars),
          onClick: (evt: MouseEvent, origin: Field) => {
            action.onClick!({
              origin: origin ?? field,
              clickEvent: evt,
              replaceVariables: boundReplaceVariables,
            });
          },
        };
      } else {
        actionModel = {
          title: replaceVariables(action.title || '', actionScopedVars),
          onClick: (evt: MouseEvent, origin: Field) => {
            buildActionOnClick(action, boundReplaceVariables);
          },
        };
      }

      return actionModel;
    });

    return actionModels.filter((action): action is ActionModel => !!action);
  };

const buildActionOnClick = (action: Action, replaceVariables: InterpolateFunction) => {
  const url = new URL(replaceVariables(action.url));
  const data = getData(action, replaceVariables);

  const requestHeaders: HeadersInit = [];
  let request: BackendSrvRequest = {
    url: url.toString(),
    method: action.method,
    data: data,
    headers: requestHeaders,
  };

  if (action.headers) {
    action.headers.forEach((param) => {
      requestHeaders.push([replaceVariables(param[0]), replaceVariables(param[1])]);
    });
  }

  if (action.queryParams) {
    action.queryParams?.forEach((param) => {
      url.searchParams.append(replaceVariables(param[0]), replaceVariables(param[1]));
    });

    request.url = url.toString();
  }

  if (action.method === HttpRequestMethod.POST) {
    requestHeaders.push(['Content-Type', action.contentType!]);
  }

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
};

const getData = (api: Action, replaceVariables: InterpolateFunction) => {
  let data: string | undefined = api.body ? replaceVariables(api.body) : '{}';
  if (api.method === HttpRequestMethod.GET) {
    data = undefined;
  }

  return data;
};
