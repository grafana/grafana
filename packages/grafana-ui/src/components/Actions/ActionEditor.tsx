import { css } from '@emotion/css';
import { ChangeEvent, memo } from 'react';

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

import { useStyles2 } from '../../themes';
import { Field } from '../Forms/Field';
import { InlineField } from '../Forms/InlineField';
import { InlineFieldRow } from '../Forms/InlineFieldRow';
import { Label } from '../Forms/Label';
import { RadioButtonGroup } from '../Forms/RadioButtonGroup/RadioButtonGroup';
import { Input } from '../Input/Input';
import { JSONFormatter } from '../JSONFormatter/JSONFormatter';
import { Select } from '../Select/Select';

import { ParamsEditor } from './ParamsEditor';
import { HTMLElementType, SuggestionsInput } from './SuggestionsInput';

interface ActionEditorProps {
  index: number;
  value: Action;
  onChange: (index: number, action: Action) => void;
  suggestions: VariableSuggestion[];
}

const LABEL_WIDTH = 13;

export const ActionEditor = memo(({ index, value, onChange, suggestions }: ActionEditorProps) => {
  const styles = useStyles2(getStyles);

  const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...value, title: event.target.value });
  };

  const onUrlChange = (url: string) => {
    onChange(index, {
      ...value,
      options: {
        ...value.options,
        url,
      },
    });
  };

  const onBodyChange = (body: string) => {
    onChange(index, {
      ...value,
      options: {
        ...value.options,
        body,
      },
    });
  };

  const onMethodChange = (method: HttpRequestMethod) => {
    onChange(index, {
      ...value,
      options: {
        ...value.options,
        method,
      },
    });
  };

  const onContentTypeChange = (contentType: SelectableValue<string>) => {
    onChange(index, {
      ...value,
      options: {
        ...value.options,
        contentType: contentType?.value,
        headers: addContentTypeHeader(value.options.headers ?? [], contentType.value!),
      },
    });
  };

  const formatCreateLabel = (input: string) => {
    return input;
  };

  const addContentTypeHeader = (headers: Array<[string, string]>, contentType: string) => {
    const hewHeaders = headers.filter(([key, value]) => key !== 'Content-Type');
    hewHeaders.push(['Content-Type', contentType]);

    return hewHeaders;
  };

  const onQueryParamsChange = (queryParams: Array<[string, string]>) => {
    onChange(index, {
      ...value,
      options: {
        ...value.options,
        queryParams,
      },
    });
  };

  const onHeadersChange = (headers: Array<[string, string]>) => {
    onChange(index, {
      ...value,
      options: {
        ...value.options,
        headers,
      },
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
        <InlineField label="URL" labelWidth={LABEL_WIDTH} grow={true}>
          <SuggestionsInput value={value.options.url} onChange={onUrlChange} suggestions={suggestions} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Method" labelWidth={LABEL_WIDTH} grow={true}>
          <RadioButtonGroup
            value={value?.options.method}
            options={httpMethodOptions}
            onChange={onMethodChange}
            fullWidth
          />
        </InlineField>
      </InlineFieldRow>
      {value?.options.method !== HttpRequestMethod.GET && (
        <InlineFieldRow>
          <InlineField label="Content-Type" labelWidth={LABEL_WIDTH} grow={true}>
            <Select
              options={contentTypeOptions}
              allowCustomValue={true}
              formatCreateLabel={formatCreateLabel}
              value={value?.options.contentType}
              onChange={onContentTypeChange}
            />
          </InlineField>
        </InlineFieldRow>
      )}

      <Field label="Query parameters" className={styles.fieldGap}>
        <ParamsEditor
          value={value?.options.queryParams ?? []}
          onChange={onQueryParamsChange}
          suggestions={suggestions}
        />
      </Field>

      <Field label="Headers">
        <ParamsEditor value={value?.options.headers ?? []} onChange={onHeadersChange} suggestions={suggestions} />
      </Field>

      {value?.options.method !== HttpRequestMethod.GET && value?.options.contentType && (
        <Field label="Body">
          <SuggestionsInput
            value={value.options.body}
            onChange={onBodyChange}
            suggestions={suggestions}
            type={HTMLElementType.TextAreaElement}
          />
        </Field>
      )}

      <br />
      {value?.options.method !== HttpRequestMethod.GET &&
        value?.options.contentType === defaultActionConfig.options.contentType &&
        renderJSON(value?.options.body ?? '{}')}
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  listItem: css({
    marginBottom: theme.spacing(),
  }),
  infoText: css({
    paddingBottom: theme.spacing(2),
    marginLeft: '66px',
    color: theme.colors.text.secondary,
  }),
  fieldGap: css({
    marginTop: theme.spacing(2),
  }),
});

ActionEditor.displayName = 'ActionEditor';
