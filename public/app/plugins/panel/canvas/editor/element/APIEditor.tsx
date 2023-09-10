import React, { useCallback } from 'react';

import { AppEvents, StandardEditorProps, StandardEditorsRegistryItem, StringFieldConfigSettings } from '@grafana/data';
import { BackendSrvRequest, config, getBackendSrv } from '@grafana/runtime';
import { Button, Field, InlineField, InlineFieldRow, JSONFormatter, RadioButtonGroup } from '@grafana/ui';
import { StringValueEditor } from 'app/core/components/OptionsUI/string';
import { appEvents } from 'app/core/core';
import { defaultApiConfig } from 'app/features/canvas/elements/button';

import { HttpRequestMethod } from '../../panelcfg.gen';

import { QueryParamsEditor } from './QueryParamsEditor';

export interface APIEditorConfig {
  method: string;
  endpoint: string;
  data?: string;
  paramsType: string;
  params?: Array<[string, string]>;
}

const dummyStringSettings = {
  settings: {},
} as StandardEditorsRegistryItem<string, StringFieldConfigSettings>;

const getRequest = (api: APIEditorConfig) => {
  const requestHeaders: HeadersInit = [];

  let request: BackendSrvRequest = {
    url: api.endpoint,
    method: api.method,
    data: getData(api),
    headers: requestHeaders,
  };

  if (api.paramsType === 'header') {
    api.params?.forEach((param) => {
      requestHeaders.push([param[0], param[1]]);
    });
  } else if (api.paramsType === 'query') {
    request.url = api.endpoint + '?' + api.params?.map((param) => param[0] + '=' + param[1]).join('&');
  }

  if (api.method === HttpRequestMethod.POST) {
    requestHeaders.push(['Content-Type', 'application/json']);
  }

  request.headers = requestHeaders;

  return request;
};

export const callApi = (api: APIEditorConfig, isTest = false) => {
  if (api && api.endpoint) {
    getBackendSrv()
      .fetch(getRequest(api))
      .subscribe({
        error: (error) => {
          if (isTest) {
            appEvents.emit(AppEvents.alertError, ['Error has occurred: ', JSON.stringify(error)]);
            console.error(error);
          }
        },
        complete: () => {
          if (isTest) {
            appEvents.emit(AppEvents.alertSuccess, ['Test successful']);
          }
        },
      });
  }
};

const getData = (api: APIEditorConfig) => {
  let data: string | undefined = api.data ?? '{}';
  if (api.method === HttpRequestMethod.GET) {
    data = undefined;
  }

  return data;
};

type Props = StandardEditorProps<APIEditorConfig>;

const httpMethodOptions = [
  { label: HttpRequestMethod.GET, value: HttpRequestMethod.GET },
  { label: HttpRequestMethod.POST, value: HttpRequestMethod.POST },
];

const httpParamsType = [
  {
    label: 'Header',
    value: 'header',
    // description: 'Send the parameters as request HTTP headers',
  },
  {
    label: 'Query',
    value: 'query',
    // description: 'Send the parameters as `key=value` query parameter',
  },
];

export function APIEditor({ value, context, onChange }: Props) {
  const LABEL_WIDTH = 9;

  if (!value) {
    value = defaultApiConfig;
  }

  const onEndpointChange = useCallback(
    (endpoint = '') => {
      onChange({
        ...value,
        endpoint,
      });
    },
    [onChange, value]
  );

  const onDataChange = useCallback(
    (data?: string) => {
      onChange({
        ...value,
        data,
      });
    },
    [onChange, value]
  );

  const onMethodChange = useCallback(
    (method: string) => {
      onChange({
        ...value,
        method,
      });
    },
    [onChange, value]
  );

  const onParamsTypeChange = useCallback(
    (paramsType: string) => {
      onChange({
        ...value,
        paramsType,
      });
    },
    [onChange, value]
  );

  const onParamsChange = useCallback(
    (params: Array<[string, string]>) => {
      onChange({
        ...value,
        params,
      });
    },
    [onChange, value]
  );

  const renderJSON = (data: string) => {
    try {
      const json = JSON.parse(data);
      return <JSONFormatter json={json} />;
    } catch (error) {
      if (error instanceof Error) {
        return `Invalid JSON provided: ${error.message}`;
      } else {
        return 'Invalid JSON provided';
      }
    }
  };

  const renderTestAPIButton = (api: APIEditorConfig) => {
    if (api && api.endpoint) {
      return (
        <Button onClick={() => callApi(api, true)} title={'Test API'}>
          Test API
        </Button>
      );
    }

    return;
  };

  return config.disableSanitizeHtml ? (
    <>
      <InlineFieldRow>
        <InlineField label="Endpoint" labelWidth={LABEL_WIDTH} grow={true}>
          <StringValueEditor
            context={context}
            value={value?.endpoint}
            onChange={onEndpointChange}
            item={dummyStringSettings}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Method" labelWidth={LABEL_WIDTH} grow={true}>
          <RadioButtonGroup value={value?.method} options={httpMethodOptions} onChange={onMethodChange} fullWidth />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Type" labelWidth={LABEL_WIDTH} tooltip="How the parameters are sent" grow={true}>
          <RadioButtonGroup
            value={value?.paramsType}
            options={httpParamsType}
            onChange={onParamsTypeChange}
            fullWidth
          />
        </InlineField>
      </InlineFieldRow>
      <Field label="Parameters" description="Query parameters">
        <QueryParamsEditor value={value?.params ?? []} onChange={onParamsChange} />
      </Field>
      {value?.method === HttpRequestMethod.POST && (
        <Field label="Payload">
          <StringValueEditor
            context={context}
            value={value?.data ?? '{}'}
            onChange={onDataChange}
            item={{...dummyStringSettings, settings: {useTextarea: true}}}
          />
        </Field>
      )}
      {renderTestAPIButton(value)}
      <br />
      {value?.method === HttpRequestMethod.POST && renderJSON(value?.data ?? '{}')}
    </>
  ) : (
    <>Must enable disableSanitizeHtml feature flag to access</>
  );
}
