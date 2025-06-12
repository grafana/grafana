import { useCallback } from 'react';

import {
  StandardEditorProps,
  StandardEditorsRegistryItem,
  StringFieldConfigSettings,
  SelectableValue,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, InlineField, InlineFieldRow, JSONFormatter, RadioButtonGroup, Select } from '@grafana/ui';
import { StringValueEditor } from 'app/core/components/OptionsUI/string';
import { defaultApiConfig } from 'app/features/canvas/elements/button';

import { HttpRequestMethod } from '../../panelcfg.gen';

import { ParamsEditor } from './ParamsEditor';
import { callApi, interpolateVariables } from './utils';

export interface APIEditorConfig {
  method: string;
  endpoint: string;
  data?: string;
  contentType?: string;
  queryParams?: Array<[string, string]>;
  headerParams?: Array<[string, string]>;
}

const dummyStringSettings: StandardEditorsRegistryItem<string, StringFieldConfigSettings> = {
  id: '',
  name: '',
  description: '',
  editor: StringValueEditor,
  settings: {},
};

type Props = StandardEditorProps<APIEditorConfig>;

const httpMethodOptions = [
  { label: HttpRequestMethod.GET, value: HttpRequestMethod.GET },
  { label: HttpRequestMethod.POST, value: HttpRequestMethod.POST },
  { label: HttpRequestMethod.PUT, value: HttpRequestMethod.PUT },
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
        <Button
          onClick={() => callApi(api)}
          title={t('canvas.apieditor.render-test-apibutton.title-test-api', 'Test API')}
        >
          <Trans i18nKey="canvas.apieditor.render-test-apibutton.test-api">Test API</Trans>
        </Button>
      );
    }

    return;
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label={t('canvas.apieditor.label-endpoint', 'Endpoint')} labelWidth={LABEL_WIDTH} grow={true}>
          <StringValueEditor
            context={context}
            value={value?.endpoint}
            onChange={onEndpointChange}
            item={dummyStringSettings}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={t('canvas.apieditor.label-method', 'Method')} labelWidth={LABEL_WIDTH} grow={true}>
          <RadioButtonGroup value={value?.method} options={httpMethodOptions} onChange={onMethodChange} fullWidth />
        </InlineField>
      </InlineFieldRow>
      {value?.method !== HttpRequestMethod.GET && (
        <InlineFieldRow>
          <InlineField
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            label="Content-Type"
            labelWidth={LABEL_WIDTH}
            grow={true}
          >
            <Select
              options={contentTypeOptions}
              allowCustomValue={true}
              formatCreateLabel={formatCreateLabel}
              value={value?.contentType}
              onChange={onContentTypeChange}
            />
          </InlineField>
        </InlineFieldRow>
      )}

      <br />
      <Field label={t('canvas.apieditor.label-query-parameters', 'Query parameters')}>
        <ParamsEditor value={value?.queryParams ?? []} onChange={onQueryParamsChange} />
      </Field>
      <Field label={t('canvas.apieditor.label-header-parameters', 'Header parameters')}>
        <ParamsEditor value={value?.headerParams ?? []} onChange={onHeaderParamsChange} />
      </Field>
      {value?.method !== HttpRequestMethod.GET && value?.contentType && (
        <Field label={t('canvas.apieditor.label-payload', 'Payload')}>
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
      {value?.method !== HttpRequestMethod.GET &&
        value?.contentType === defaultApiConfig.contentType &&
        renderJSON(value?.data ?? '{}')}
    </>
  );
}
