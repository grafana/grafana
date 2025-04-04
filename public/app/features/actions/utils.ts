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
import { BackendDataSourceResponse, config, getBackendSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/core';

import { HttpRequestMethod } from '../../plugins/panel/canvas/panelcfg.gen';
import { createAbsoluteUrl, RelativeUrl } from '../alerting/unified/utils/url';
import { getNextRequestId } from '../query/state/PanelQueryRunner';

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
  const useInfinityDatasource = config.featureToggles.vizActionsAuth && action.fetch.datasourceUid;
  if (useInfinityDatasource) {
    try {
      const url = new URL(getUrl(replaceVariables(action.fetch.url)));
      const requestId = getNextRequestId();
      const infinityUrl = `api/ds/query?ds_type=yesoreyeram-infinity-datasource&requestId=${requestId}`;

      const requestHeaders: any = [];
      const queryParams: any = [];
      let contentType = 'application/json';

      const infinityUrlOptions = {
        method: action.fetch.method,
        data: getData(action, replaceVariables),
        headers: requestHeaders,
        params: queryParams,
        body_type: 'raw',
        body_content_type: contentType,
      };

      if (action.fetch.headers) {
        action.fetch.headers.forEach(([name, value]) => {
          requestHeaders.push({ key: replaceVariables(name), value: replaceVariables(value) });
          if (name.toLowerCase() === 'content-type') {
            contentType = value;
          }
        });
      }

      if (action.fetch.queryParams) {
        action.fetch.queryParams?.forEach(([name, value]) => {
          queryParams.push({ key: replaceVariables(name), value: replaceVariables(value) });
        });
      }

      infinityUrlOptions.headers = requestHeaders;

      const infinityRequest = {
        url: infinityUrl,
        method: HttpRequestMethod.POST,
        data: {
          queries: [
            {
              refId: 'A',
              datasource: {
                type: 'yesoreyeram-infinity-datasource',
                uid: action.fetch.datasourceUid,
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

      getBackendSrv()
        .fetch<BackendDataSourceResponse>(infinityRequest)
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
