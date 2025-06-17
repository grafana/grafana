import { css } from '@emotion/css';
import { memo } from 'react';

import {
  Action,
  GrafanaTheme2,
  httpMethodOptions,
  HttpRequestMethod,
  VariableSuggestion,
  ActionVariable,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Switch,
  Field,
  InlineField,
  InlineFieldRow,
  RadioButtonGroup,
  JSONFormatter,
  useStyles2,
  ColorPicker,
  useTheme2,
} from '@grafana/ui';

import { HTMLElementType, SuggestionsInput } from '../transformers/suggestionsInput/SuggestionsInput';

import { ActionVariablesEditor } from './ActionVariablesEditor';
import { ParamsEditor } from './ParamsEditor';

interface ActionEditorProps {
  index: number;
  value: Action;
  onChange: (index: number, action: Action) => void;
  suggestions: VariableSuggestion[];
  showOneClick?: boolean;
}

const LABEL_WIDTH = 13;

export const ActionEditor = memo(({ index, value, onChange, suggestions, showOneClick }: ActionEditorProps) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const onTitleChange = (title: string) => {
    onChange(index, { ...value, title });
  };

  const onConfirmationChange = (confirmation: string) => {
    onChange(index, { ...value, confirmation });
  };

  const onOneClickChanged = () => {
    onChange(index, { ...value, oneClick: !value.oneClick });
  };

  const onUrlChange = (url: string) => {
    onChange(index, {
      ...value,
      fetch: {
        ...value.fetch,
        url,
      },
    });
  };

  const onBodyChange = (body: string) => {
    onChange(index, {
      ...value,
      fetch: {
        ...value.fetch,
        body,
      },
    });
  };

  const onMethodChange = (method: HttpRequestMethod) => {
    onChange(index, {
      ...value,
      fetch: {
        ...value.fetch,
        method,
      },
    });
  };

  const onVariablesChange = (variables: ActionVariable[]) => {
    onChange(index, {
      ...value,
      variables,
    });
  };

  const onQueryParamsChange = (queryParams: Array<[string, string]>) => {
    onChange(index, {
      ...value,
      fetch: {
        ...value.fetch,
        queryParams,
      },
    });
  };

  const onHeadersChange = (headers: Array<[string, string]>) => {
    onChange(index, {
      ...value,
      fetch: {
        ...value.fetch,
        headers,
      },
    });
  };

  const onBackgroundColorChange = (backgroundColor: string) => {
    onChange(index, {
      ...value,
      style: {
        ...value.style,
        backgroundColor,
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
    value.fetch.method !== HttpRequestMethod.GET &&
    value.fetch.headers?.some(([name, value]) => name === 'Content-Type' && value === 'application/json');

  return (
    <div className={styles.listItem}>
      <Field label={t('grafana-ui.action-editor.modal.action-title', 'Title')} className={styles.inputField}>
        <SuggestionsInput
          value={value.title}
          onChange={onTitleChange}
          suggestions={suggestions}
          autoFocus={value.title === ''}
          placeholder={t('grafana-ui.action-editor.modal.action-title-placeholder', 'Action title')}
        />
      </Field>

      <Field
        label={t('grafana-ui.viz-tooltip.actions-confirmation-label', 'Confirmation message')}
        description={t(
          'grafana-ui.viz-tooltip.actions-confirmation-message',
          'Provide a descriptive prompt to confirm or cancel the action.'
        )}
        className={styles.inputField}
      >
        <SuggestionsInput
          value={value.confirmation}
          onChange={onConfirmationChange}
          suggestions={suggestions}
          placeholder={t(
            'grafana-ui.viz-tooltip.actions-confirmation-input-placeholder',
            'Are you sure you want to {{ actionTitle }}?',
            { actionTitle: value.title || '... ' }
          )}
        />
      </Field>

      <Field label={t('grafana-ui.action-editor.button.style', 'Button style')}>
        <InlineField
          label={t('actions.action-editor.button.style.background-color', 'Color')}
          labelWidth={LABEL_WIDTH}
          className={styles.colorPicker}
        >
          <ColorPicker
            color={value?.style?.backgroundColor || theme.colors.secondary.main}
            onChange={onBackgroundColorChange}
          />
        </InlineField>
      </Field>

      {showOneClick && (
        <Field
          label={t('grafana-ui.data-link-inline-editor.one-click', 'One click')}
          description={t(
            'grafana-ui.action-editor.modal.one-click-description',
            'Only one link or action can have one click enabled at a time'
          )}
        >
          <Switch value={value.oneClick || false} onChange={onOneClickChanged} />
        </Field>
      )}

      <InlineFieldRow>
        <InlineField
          label={t('grafana-ui.action-editor.modal.action-method', 'Method')}
          labelWidth={LABEL_WIDTH}
          grow={true}
        >
          <RadioButtonGroup<HttpRequestMethod>
            value={value?.fetch.method}
            options={httpMethodOptions}
            onChange={onMethodChange}
            fullWidth
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField label={t('actions.action-editor.label-url', 'URL')} labelWidth={LABEL_WIDTH} grow={true}>
          <SuggestionsInput
            value={value.fetch.url}
            onChange={onUrlChange}
            suggestions={suggestions}
            placeholder={t('actions.action-editor.placeholder-url', 'URL')}
          />
        </InlineField>
      </InlineFieldRow>

      <Field
        label={t('grafana-ui.action-editor.modal.action-variables', 'Variables')}
        className={styles.fieldGap}
        noMargin
      >
        <ActionVariablesEditor onChange={onVariablesChange} value={value.variables ?? []} />
      </Field>

      <Field
        label={t('grafana-ui.action-editor.modal.action-query-params', 'Query parameters')}
        className={styles.fieldGap}
      >
        <ParamsEditor value={value?.fetch.queryParams ?? []} onChange={onQueryParamsChange} suggestions={suggestions} />
      </Field>

      <Field label={t('actions.action-editor.label-headers', 'Headers')}>
        <ParamsEditor
          value={value?.fetch.headers ?? []}
          onChange={onHeadersChange}
          suggestions={suggestions}
          contentTypeHeader={true}
        />
      </Field>

      {value?.fetch.method !== HttpRequestMethod.GET && (
        <Field label={t('grafana-ui.action-editor.modal.action-body', 'Body')} className={styles.inputField}>
          <SuggestionsInput
            value={value.fetch.body}
            onChange={onBodyChange}
            suggestions={suggestions}
            type={HTMLElementType.TextAreaElement}
          />
        </Field>
      )}

      {shouldRenderJSON && (
        <>
          <br />
          {renderJSON(value?.fetch.body)}
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
  inputField: css({
    marginRight: 4,
  }),
  colorPicker: css({
    display: 'flex',
    alignItems: 'center',
  }),
});

ActionEditor.displayName = 'ActionEditor';
