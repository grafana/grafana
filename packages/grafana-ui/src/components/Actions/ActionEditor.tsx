import { css } from '@emotion/css';
import { ChangeEvent, memo, useCallback } from 'react';

import { GrafanaTheme2, Action, SelectableValue } from '@grafana/data';

// eslint-disable-next-line no-restricted-imports
import { contentTypeOptions, httpMethodOptions } from '@grafana/data/src/types/action';

import { defaultApiConfig } from '../../../../../public/app/features/canvas/elements/button';
import { ParamsEditor } from '../../../../../public/app/plugins/panel/canvas/editor/element/ParamsEditor';
import { callApi, interpolateVariables } from '../../../../../public/app/plugins/panel/canvas/editor/element/utils';
import { HttpRequestMethod } from '../../../../../public/app/plugins/panel/canvas/panelcfg.gen';
import { useStyles2 } from '../../themes';
import { Button } from '../Button';
import { Field } from '../Forms/Field';
import { InlineField } from '../Forms/InlineField';
import { InlineFieldRow } from '../Forms/InlineFieldRow';
import { RadioButtonGroup } from '../Forms/RadioButtonGroup/RadioButtonGroup';
import { Input } from '../Input/Input';
import { JSONFormatter } from '../JSONFormatter/JSONFormatter';
import { Select } from '../Select/Select';
import { TextArea } from '../TextArea/TextArea';

interface ActionEditorProps {
  value: Action;
  index: number;
  onChange: (index: number, action: Action, callback?: () => void) => void;
}

const LABEL_WIDTH = 13;

export const ActionEditor = memo(({ index, value, onChange }: ActionEditorProps) => {
  const styles = useStyles2(getStyles);

  const onTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(index, { ...value, title: event.target.value });
    },
    [index, onChange, value]
  );

  const onEndpointChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(index, { ...value, endpoint: event.target.value });
    },
    [index, onChange, value]
  );

  const onPayloadChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(index, {
        ...value,
        data: event.target.value,
      });
    },
    [index, onChange, value]
  );

  const onMethodChange = useCallback(
    (method: string) => {
      onChange(index, {
        ...value,
        method,
      });
    },
    [index, onChange, value]
  );

  const onContentTypeChange = useCallback(
    (contentType: SelectableValue<string>) => {
      onChange(index, {
        ...value,
        contentType: contentType?.value,
      });
    },
    [index, onChange, value]
  );

  const formatCreateLabel = (input: string) => {
    return input;
  };

  const onQueryParamsChange = useCallback(
    (queryParams: Array<[string, string]>) => {
      onChange(index, {
        ...value,
        queryParams,
      });
    },
    [index, onChange, value]
  );

  const onHeaderParamsChange = useCallback(
    (headerParams: Array<[string, string]>) => {
      onChange(index, {
        ...value,
        headerParams,
      });
    },
    [index, onChange, value]
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

  const renderTestAPIButton = (api: Action) => {
    if (api && api.endpoint) {
      return (
        <Button onClick={() => callApi(api)} title="Test API">
          Test API
        </Button>
      );
    }

    return;
  };

  return (
    <div className={styles.listItem}>
      <InlineFieldRow>
        <InlineField label="Title" labelWidth={LABEL_WIDTH} grow={true}>
          <Input value={value.title} onChange={onTitleChange} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Endpoint" labelWidth={LABEL_WIDTH} grow={true}>
          <Input value={value.endpoint} onChange={onEndpointChange} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Method" labelWidth={LABEL_WIDTH} grow={true}>
          <RadioButtonGroup value={value?.method} options={httpMethodOptions} onChange={onMethodChange} fullWidth />
        </InlineField>
      </InlineFieldRow>
      {value?.method !== HttpRequestMethod.GET && (
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
      )}

      <br />
      <Field label="Query parameters">
        <ParamsEditor value={value?.queryParams ?? []} onChange={onQueryParamsChange} />
      </Field>
      <Field label="Header parameters">
        <ParamsEditor value={value?.headerParams ?? []} onChange={onHeaderParamsChange} />
      </Field>
      {value?.method !== HttpRequestMethod.GET && value?.contentType && (
        <Field label="Payload">
          <TextArea value={value.title} onChange={onPayloadChange} />
        </Field>
      )}
      {renderTestAPIButton(value)}
      <br />
      {value?.method !== HttpRequestMethod.GET &&
        value?.contentType === defaultApiConfig.contentType &&
        renderJSON(value?.data ?? '{}')}
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  listItem: css({
    marginBottom: theme.spacing(),
  }),
});

ActionEditor.displayName = 'ActionEditor';
