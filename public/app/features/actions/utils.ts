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
  InterpolateFunction,
  ScopedVars,
  textUtil,
  ValueLinkConfig,
} from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
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
      onClick: (evt: MouseEvent, origin: Field) => {
        buildActionOnClick(action, boundReplaceVariables);
      },
      oneClick: action.oneClick ?? false,
    };

    return actionModel;
  });

  return actionModels.filter((action): action is ActionModel => !!action);
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
