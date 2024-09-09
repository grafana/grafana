import { css } from '@emotion/css';
import { memo } from 'react';

import { Action, GrafanaTheme2, httpMethodOptions, HttpRequestMethod, VariableSuggestion } from '@grafana/data';
import { Field } from '@grafana/ui/src/components/Forms/Field';
import { InlineField } from '@grafana/ui/src/components/Forms/InlineField';
import { InlineFieldRow } from '@grafana/ui/src/components/Forms/InlineFieldRow';
import { RadioButtonGroup } from '@grafana/ui/src/components/Forms/RadioButtonGroup/RadioButtonGroup';
import { JSONFormatter } from '@grafana/ui/src/components/JSONFormatter/JSONFormatter';
import { useStyles2 } from '@grafana/ui/src/themes';

import { HTMLElementType, SuggestionsInput } from '../transformers/suggestionsInput/SuggestionsInput';

import { ParamsEditor } from './ParamsEditor';

interface ActionEditorProps {
  index: number;
  value: Action;
  onChange: (index: number, action: Action) => void;
  suggestions: VariableSuggestion[];
}

const LABEL_WIDTH = 13;

export const ActionEditor = memo(({ index, value, onChange, suggestions }: ActionEditorProps) => {
  const styles = useStyles2(getStyles);

  const onTitleChange = (title: string) => {
    onChange(index, { ...value, title });
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

  const renderJSON = (data = '{}') => {
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

  const shouldRenderJSON =
    value.options.method !== HttpRequestMethod.GET &&
    value.options.headers?.some(([name, value]) => name === 'Content-Type' && value === 'application/json');

  return (
    <div className={styles.listItem}>
      <Field label="Title">
        <SuggestionsInput
          value={value.title}
          onChange={onTitleChange}
          suggestions={suggestions}
          autoFocus={value.title === ''}
          placeholder="Action title"
        />
      </Field>

      <InlineFieldRow>
        <InlineField label="Method" labelWidth={LABEL_WIDTH} grow={true}>
          <RadioButtonGroup<HttpRequestMethod>
            value={value?.options.method}
            options={httpMethodOptions}
            onChange={onMethodChange}
            fullWidth
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField label="URL" labelWidth={LABEL_WIDTH} grow={true}>
          <SuggestionsInput
            value={value.options.url}
            onChange={onUrlChange}
            suggestions={suggestions}
            placeholder="URL"
          />
        </InlineField>
      </InlineFieldRow>

      <Field label="Query parameters" className={styles.fieldGap}>
        <ParamsEditor
          value={value?.options.queryParams ?? []}
          onChange={onQueryParamsChange}
          suggestions={suggestions}
        />
      </Field>

      <Field label="Headers">
        <ParamsEditor
          value={value?.options.headers ?? []}
          onChange={onHeadersChange}
          suggestions={suggestions}
          contentTypeHeader={true}
        />
      </Field>

      {value?.options.method !== HttpRequestMethod.GET && (
        <Field label="Body">
          <SuggestionsInput
            value={value.options.body}
            onChange={onBodyChange}
            suggestions={suggestions}
            type={HTMLElementType.TextAreaElement}
          />
        </Field>
      )}

      {shouldRenderJSON && (
        <>
          <br />
          {renderJSON(value?.options.body)}
        </>
      )}
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
