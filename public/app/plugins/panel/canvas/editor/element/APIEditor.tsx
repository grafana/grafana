import React, { useCallback } from 'react';

import { StandardEditorProps, StandardEditorsRegistryItem, StringFieldConfigSettings } from '@grafana/data';
import { BackendSrvRequest, config, getTemplateSrv } from '@grafana/runtime';
import { Button, Field, InlineField, InlineFieldRow, JSONFormatter, RadioButtonGroup } from '@grafana/ui';
import { StringValueEditor } from 'app/core/components/OptionsUI/string';
import { defaultApiConfig } from 'app/features/canvas/elements/button';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { HttpRequestMethod } from '../../panelcfg.gen';

import { QueryParamsEditor } from './QueryParamsEditor';
import { callApi } from './utils';

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

  // @TODO ??
  const panel = getDashboardSrv().getCurrent()?.panelInEdit;

  const interpolateVariables = (text: string) => {
    return getTemplateSrv().replace(text, panel?.scopedVars);
  };

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

  const getRequest = () => {
    const requestHeaders: HeadersInit = [];
    const api = value;

    const url = new URL(interpolateVariables(api.endpoint!));

    let request: BackendSrvRequest = {
      url: url.toString(),
      method: api.method,
      data: getData(),
      headers: requestHeaders,
    };

    if (api.paramsType === 'header') {
      api.params?.forEach((param) => {
        requestHeaders.push([interpolateVariables(param[0]), interpolateVariables(param[1])]);
      });
    } else if (api.paramsType === 'query') {
      api.params?.forEach((param) => {
        url.searchParams.append(interpolateVariables(param[0]), interpolateVariables(param[1]));
      });

      request.url = url.toString();
    }

    if (api.method === HttpRequestMethod.POST) {
      requestHeaders.push(['Content-Type', 'application/json']);
    }

    request.headers = requestHeaders;

    return request;
  };

  const getData = () => {
    let data: string | undefined = value.data ? interpolateVariables(value.data) : '{}';
    if (value.method === HttpRequestMethod.GET) {
      data = undefined;
    }

    return data;
  };

  const renderJSON = (data: string) => {
    try {
      const json = JSON.parse(interpolateVariables(data));
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
        <Button onClick={() => callApi(api, true, getRequest())} title={'Test API'}>
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
            item={{ ...dummyStringSettings, settings: { useTextarea: true } }}
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
