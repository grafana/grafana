import React, { useCallback } from 'react';

import { StandardEditorProps, StandardEditorsRegistryItem, StringFieldConfigSettings, SelectableValue } from '@grafana/data';
import { BackendSrvRequest, config, getTemplateSrv } from '@grafana/runtime';
import { Button, Field, InlineField, InlineFieldRow, JSONFormatter, RadioButtonGroup, Select } from '@grafana/ui';
import { StringValueEditor } from 'app/core/components/OptionsUI/string';
import { defaultApiConfig } from 'app/features/canvas/elements/button';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { HttpRequestMethod } from '../../panelcfg.gen';

import { ParamsEditor } from './ParamsEditor';
import { callApi } from './utils';

export interface APIEditorConfig {
  method: string;
  endpoint: string;
  data?: string;
  contentType?: string;
  queryParams?: Array<[string, string]>;
  headerParams?: Array<[string, string]>;
}

const dummyStringSettings = {
  settings: {},
} as StandardEditorsRegistryItem<string, StringFieldConfigSettings>;

type Props = StandardEditorProps<APIEditorConfig>;

const httpMethodOptions = [
  { label: HttpRequestMethod.GET, value: HttpRequestMethod.GET },
  { label: HttpRequestMethod.POST, value: HttpRequestMethod.POST },
];

const contentTypeOptions: SelectableValue[] = [
  { label: 'JSON', value: 'application/json' },
  { label: 'Text', value: 'text/plain' },
  { label: 'JavaScript', value: 'application/javascript' },
  { label: 'HTML', value: 'text/html' },
  { label: 'XML', value: 'application/XML' },
  { label: 'x-www-form-urlencoded', value: 'application/x-www-form-urlencoded' },
];

export function APIEditor({ value, context, onChange }: Props) {
  const LABEL_WIDTH = 13;

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

  const onContentTypeChange = useCallback(
    (contentType: SelectableValue<string>) => {
      onChange({
        ...value,
        contentType: contentType?.value,
      });
    },
    [onChange, value]
  );

  const formatCreateLabel = (input: string) => {
    return input;
  };

  const onQueryParamsChange = useCallback(
    (queryParams: Array<[string, string]>) => {
      onChange({
        ...value,
        queryParams,
      });
    },
    [onChange, value]
  );

  const onHeaderParamsChange = useCallback(
    (headerParams: Array<[string, string]>) => {
      onChange({
        ...value,
        headerParams,
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

        if (api.headerParams) {
            api.headerParams.forEach((param) => {
                requestHeaders.push([interpolateVariables(param[0]), interpolateVariables(param[1])]);
            });
        }

        if (api.queryParams) {
            api.queryParams?.forEach((param) => {
                url.searchParams.append(interpolateVariables(param[0]), interpolateVariables(param[1]));
            });

            request.url = url.toString();
        }

        if (api.method === HttpRequestMethod.POST) {
            requestHeaders.push(['Content-Type', api.contentType!]);
        }

        request.headers = requestHeaders;

        return request;
    }

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
      <Field label="Query parameters">
        <ParamsEditor value={value?.queryParams ?? []} onChange={onQueryParamsChange} />
      </Field>
      <Field label="Header parameters">
        <ParamsEditor value={value?.headerParams ?? []} onChange={onHeaderParamsChange} />
      </Field>
      {value?.method === HttpRequestMethod.POST && (
        <>
          <InlineFieldRow>
            <InlineField label="Content-Type" labelWidth={LABEL_WIDTH} grow={true}>
              <Select
                options={contentTypeOptions}
                allowCustomValue={true}
                formatCreateLabel={formatCreateLabel}
                value={value?.contentType}
                onChange={onContentTypeChange}
              />
            </InlineField>
          </InlineFieldRow>
          {value?.contentType && (
            <Field label="Payload">
              <StringValueEditor
                context={context}
                value={value?.data ?? '{}'}
                onChange={onDataChange}
                item={{ ...dummyStringSettings, settings: { useTextarea: true } }}
              />
            </Field>
          )}
        </>
      )}
      {renderTestAPIButton(value)}
      <br />
      {value?.method === HttpRequestMethod.POST &&
        value?.contentType === defaultApiConfig.contentType &&
        renderJSON(value?.data ?? '{}')}
    </>
  ) : (
    <>Must enable disableSanitizeHtml feature flag to access</>
  );
}
