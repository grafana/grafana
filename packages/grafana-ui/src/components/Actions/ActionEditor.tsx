import {css} from '@emotion/css';
import {ChangeEvent, memo} from 'react';

import {
  Action,
  contentTypeOptions,
  defaultActionConfig,
  GrafanaTheme2,
  httpMethodOptions,
  HttpRequestMethod,
  SelectableValue,
  VariableSuggestion,
} from '@grafana/data';

import {useStyles2} from '../../themes';
import {Field} from '../Forms/Field';
import {InlineField} from '../Forms/InlineField';
import {InlineFieldRow} from '../Forms/InlineFieldRow';
import {Label} from '../Forms/Label';
import {RadioButtonGroup} from '../Forms/RadioButtonGroup/RadioButtonGroup';
import {Input} from '../Input/Input';
import {JSONFormatter} from '../JSONFormatter/JSONFormatter';
import {Select} from '../Select/Select';

import {ParamsEditor} from './ParamsEditor';
import {HTMLElementType, SuggestionsInput} from './SuggestionsInput';

interface ActionEditorProps {
  index: number;
  value: Action;
  onChange: (index: number, action: Action) => void;
  suggestions: VariableSuggestion[];
}

const getStyles = (theme: GrafanaTheme2) => ({
  listItem: css({
    marginBottom: theme.spacing(),
  }),
  infoText: css({
    paddingBottom: theme.spacing(2),
    marginLeft: '66px',
    color: theme.colors.text.secondary,
  }),
});

const LABEL_WIDTH = 13;

export const ActionEditor = memo(({ index, value, onChange, suggestions }: ActionEditorProps) => {
  const styles = useStyles2(getStyles);

  const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...value, title: event.target.value });
  };

  const onEndpointChange = (endpoint: string) => {
    onChange(index, { ...value, endpoint });
  };

  const onPayloadChange = (payload: string) => {
    onChange(index, {
      ...value,
      data: payload,
    });
  };

  const onMethodChange = (method: string) => {
    onChange(index, {
      ...value,
      method,
    });
  };

  const onContentTypeChange = (contentType: SelectableValue<string>) => {
    onChange(index, {
      ...value,
      contentType: contentType?.value,
    });
  };

  const formatCreateLabel = (input: string) => {
    return input;
  };

  const onQueryParamsChange = (queryParams: Array<[string, string]>) => {
    onChange(index, {
      ...value,
      queryParams,
    });
  };

  const onHeaderParamsChange = (headerParams: Array<[string, string]>) => {
    onChange(index, {
      ...value,
      headerParams,
    });
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

  return (
    <div className={styles.listItem}>
      <Field label="Title">
        <Input value={value.title} onChange={onTitleChange} />
      </Field>
      <Label>API</Label>
      <InlineFieldRow>
        <InlineField label="Endpoint" labelWidth={LABEL_WIDTH} grow={true}>
          <SuggestionsInput value={value.endpoint} onChange={onEndpointChange} suggestions={suggestions} />
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

      <Field label="Query parameters">
        <ParamsEditor value={value?.queryParams ?? []} onChange={onQueryParamsChange} suggestions={suggestions} />
      </Field>
      <Field label="Header parameters">
        <ParamsEditor value={value?.headerParams ?? []} onChange={onHeaderParamsChange} suggestions={suggestions} />
      </Field>

      {value?.method !== HttpRequestMethod.GET && value?.contentType && (
        <Field label="Payload">
          <SuggestionsInput
            value={value.data}
            onChange={onPayloadChange}
            suggestions={suggestions}
            type={HTMLElementType.TextAreaElement}
          />
        </Field>
      )}

      <br />
      {value?.method !== HttpRequestMethod.GET &&
        value?.contentType === defaultActionConfig.contentType &&
        renderJSON(value?.data ?? '{}')}
    </div>
  );
});

ActionEditor.displayName = 'ActionEditor';
