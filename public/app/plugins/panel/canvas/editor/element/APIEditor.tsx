import React, { useCallback } from 'react';

import { AppEvents, StandardEditorProps, StandardEditorsRegistryItem, StringFieldConfigSettings } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { Button, InlineField, InlineFieldRow, JSONFormatter, RadioButtonGroup } from '@grafana/ui';
import { StringValueEditor } from 'app/core/components/OptionsUI/string';
import { appEvents } from 'app/core/core';

export interface APIEditorConfig {
  method: string;
  endpoint: string;
  data?: string;
}

const dummyStringSettings = {
  settings: {},
} as StandardEditorsRegistryItem<string, StringFieldConfigSettings>;

export const callApi = (api: APIEditorConfig, isTest = false) => {
  if (api) {
    getBackendSrv()
      .fetch({
        url: api.endpoint,
        method: api.method,
        data: api.method === 'GET' ? undefined : api.data ?? '{}',
      })
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

type Props = StandardEditorProps<APIEditorConfig>;

// @TODO Extract as type, support other methods?
const httpMethodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
];

export function APIEditor({ value, context, onChange }: Props) {
  const LABEL_WIDTH = 9;

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
    (method: any) => {
      onChange({
        ...value,
        method,
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

  const httpMethod = value.method ?? 'GET';

  return config.disableSanitizeHtml ? (
    <>
      <InlineFieldRow>
        <InlineField label="Method" labelWidth={LABEL_WIDTH} grow={true}>
          <RadioButtonGroup value={httpMethod} options={httpMethodOptions} onChange={onMethodChange} fullWidth />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={'Endpoint'} labelWidth={LABEL_WIDTH} grow={true} required>
          <StringValueEditor
            context={context}
            value={value?.endpoint}
            onChange={onEndpointChange}
            item={dummyStringSettings}
          />
        </InlineField>
      </InlineFieldRow>
      { httpMethod === 'POST' && <InlineFieldRow>
        <InlineField label={'Data'} labelWidth={LABEL_WIDTH} grow={true}>
          <StringValueEditor
            context={context}
            value={value?.data ?? '{}'}
            onChange={onDataChange}
            item={dummyStringSettings}
          />
        </InlineField>
      </InlineFieldRow>}
      {renderTestAPIButton(value)}
      <br />
      { httpMethod === 'POST' && renderJSON(value?.data ?? '{}')}
    </>
  ) : (
    <>Must enable disableSanitizeHtml feature flag to access</>
  );
}
