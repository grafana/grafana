import React, { useCallback } from 'react';

import {
  AppEvents,
  SelectableValue,
  StandardEditorProps,
  StandardEditorsRegistryItem,
  StringFieldConfigSettings,
} from '@grafana/data';
import { BackendSrvRequest, config, getBackendSrv } from '@grafana/runtime';
import { Button, Field, InlineField, InlineFieldRow, JSONFormatter, RadioButtonGroup, Select } from '@grafana/ui';
import { StringValueEditor } from 'app/core/components/OptionsUI/string';
import { appEvents } from 'app/core/core';
import { defaultApiConfig } from 'app/features/canvas/elements/button';

import { HttpRequestMethod } from '../../panelcfg.gen';

export interface APIEditorConfig {
  method: string;
  endpoint: string;
  data?: string;
  contentType?: string;
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

  if (api.method === HttpRequestMethod.POST) {
    requestHeaders.push(['Content-Type', api.contentType!]);
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

const contentTypeOptions: SelectableValue[] = [
  { label: 'JSON', value: 'application/json' },
  { label: 'Text', value: 'text/plain' },
  { label: 'JavaScript', value: 'application/javascript' },
  { label: 'HTML', value: 'text/html' },
  { label: 'XML', value: 'application/XML' },
  { label: 'x-www-form-urlencoded', value: 'application/x-www-form-urlencoded' },
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
      {value?.method === HttpRequestMethod.POST && (
        <>
          <Field label="Content-Type">
            <Select
              minMenuHeight={200}
              options={contentTypeOptions}
              allowCustomValue={true}
              formatCreateLabel={formatCreateLabel}
              value={value?.contentType}
              onChange={onContentTypeChange}
            />
          </Field>
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
      {value?.method === HttpRequestMethod.POST && renderJSON(value?.data ?? '{}')}
    </>
  ) : (
    <>Must enable disableSanitizeHtml feature flag to access</>
  );
}
