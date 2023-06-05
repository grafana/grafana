import React, { useCallback } from 'react';

import { AppEvents, StandardEditorProps, StandardEditorsRegistryItem, StringFieldConfigSettings } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { Button, InlineField, InlineFieldRow, JSONFormatter } from '@grafana/ui';
import { StringValueEditor } from 'app/core/components/OptionsUI/string';
import { appEvents } from 'app/core/core';

export interface APIEditorConfig {
  endpoint: string;
  data?: string;
}

const dummyStringSettings: StandardEditorsRegistryItem<string, StringFieldConfigSettings> = {
  settings: {},
} as any;

export const callApi = (api: APIEditorConfig, isTest = false) => {
  if (api) {
    getBackendSrv()
      .fetch({
        url: api.endpoint!,
        method: 'POST',
        data: api.data ?? {},
      })
      .subscribe({
        error: (error: any) => {
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

type Props = StandardEditorProps<APIEditorConfig, any, any>;

export function APIEditor({ value, context, onChange }: Props) {
  const labelWidth = 9;

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
        <InlineField label={'Endpoint'} labelWidth={labelWidth} grow={true}>
          <StringValueEditor
            context={context}
            value={value?.endpoint}
            onChange={onEndpointChange}
            item={dummyStringSettings}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={'Data'} labelWidth={labelWidth} grow={true}>
          <StringValueEditor
            context={context}
            value={value?.data ?? '{}'}
            onChange={onDataChange}
            item={dummyStringSettings}
          />
        </InlineField>
      </InlineFieldRow>
      {renderTestAPIButton(value)}
      <br />
      {renderJSON(value?.data ?? '{}')}
    </>
  ) : (
    <>Must enable disableSanitizeHtml feature flag to access</>
  );
}
