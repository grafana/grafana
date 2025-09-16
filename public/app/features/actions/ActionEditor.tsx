import { css } from '@emotion/css';
import { memo } from 'react';

import {
  Action,
  ActionType,
  DataSourceInstanceSettings,
  GrafanaTheme2,
  httpMethodOptions,
  HttpRequestMethod,
  VariableSuggestion,
  InfinityOptions,
  FetchOptions,
  ActionVariable,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  ColorPicker,
  Field,
  InlineField,
  InlineFieldRow,
  JSONFormatter,
  RadioButtonGroup,
  Switch,
  useStyles2,
  useTheme2,
} from '@grafana/ui';

import { HTMLElementType, SuggestionsInput } from '../transformers/suggestionsInput/SuggestionsInput';

import { ActionVariablesEditor } from './ActionVariablesEditor';
import { ConnectionPicker } from './ConnectionPicker';
import { ParamsEditor } from './ParamsEditor';

interface ActionEditorProps {
  index: number;
  value: Action;
  onChange: (index: number, action: Action) => void;
  suggestions: VariableSuggestion[];
  showOneClick?: boolean;
}

const LABEL_WIDTH = 13;

const DEFAULT_HTTP_CONFIG: FetchOptions = {
  method: HttpRequestMethod.POST,
  url: '',
  body: '{}',
  queryParams: [],
  headers: [['Content-Type', 'application/json']],
};

export const ActionEditor = memo(({ index, value, onChange, suggestions, showOneClick }: ActionEditorProps) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const getActionConfig = (): FetchOptions | InfinityOptions => {
    if (value.type === ActionType.Infinity) {
      return (
        value[ActionType.Infinity] || {
          ...DEFAULT_HTTP_CONFIG,
          datasourceUid: '',
        }
      );
    }

    return value[ActionType.Fetch] || DEFAULT_HTTP_CONFIG;
  };

  const updateActionConfig = (updates: Partial<FetchOptions | InfinityOptions>) => {
    const configKey = value.type === ActionType.Infinity ? ActionType.Infinity : ActionType.Fetch;
    const baseConfig = getActionConfig();

    const updatedConfig = {
      ...baseConfig,
      ...updates,
      ...(value.type === ActionType.Infinity && {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        datasourceUid: (baseConfig as InfinityOptions).datasourceUid || '',
      }),
    };

    onChange(index, {
      ...value,
      [configKey]: updatedConfig,
    });
  };

  const updateConfig =
    <K extends keyof (FetchOptions & InfinityOptions)>(field: K) =>
    (newValue: (FetchOptions & InfinityOptions)[K]) => {
      updateActionConfig({ [field]: newValue });
    };

  const onTitleChange = (title: string) => {
    onChange(index, { ...value, title });
  };

  const onConfirmationChange = (confirmation: string) => {
    onChange(index, { ...value, confirmation });
  };

  const onVariablesChange = (variables: ActionVariable[]) => {
    onChange(index, {
      ...value,
      variables,
    });
  };

  const onOneClickChanged = () => {
    onChange(index, { ...value, oneClick: !value.oneClick });
  };

  const onUrlChange = updateConfig('url');
  const onBodyChange = updateConfig('body');
  const onMethodChange = updateConfig('method');
  const onQueryParamsChange = updateConfig('queryParams');
  const onHeadersChange = updateConfig('headers');

  const onBackgroundColorChange = (backgroundColor: string) => {
    onChange(index, {
      ...value,
      style: {
        ...value.style,
        backgroundColor,
      },
    });
  };

  const onConnectionChange = (connectionType: string | DataSourceInstanceSettings) => {
    const baseAction = {
      title: value.title,
      confirmation: value.confirmation,
      oneClick: value.oneClick,
      variables: value.variables,
      style: value.style,
    };

    if (typeof connectionType === 'string') {
      onChange(index, {
        ...baseAction,
        type: ActionType.Fetch,
        [ActionType.Fetch]: getActionConfig(),
      });
    } else {
      onChange(index, {
        ...baseAction,
        type: ActionType.Infinity,
        [ActionType.Infinity]: {
          ...getActionConfig(),
          datasourceUid: connectionType.uid,
        },
      });
    }
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

  const actionConfig = getActionConfig();
  const shouldRenderJSON =
    actionConfig.method !== HttpRequestMethod.GET &&
    actionConfig.headers?.some(
      ([name, value]: [string, string]) => name === 'Content-Type' && value === 'application/json'
    );

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
        <InlineField label={t('grafana-ui.action-editor.modal.connection', 'Connection')} labelWidth={LABEL_WIDTH}>
          <ConnectionPicker
            actionType={value.type}
            datasourceUid={value?.[ActionType.Infinity]?.datasourceUid}
            onChange={onConnectionChange}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField label={t('grafana-ui.action-editor.modal.action-method', 'Method')} labelWidth={LABEL_WIDTH}>
          <RadioButtonGroup<HttpRequestMethod>
            value={actionConfig.method}
            options={httpMethodOptions}
            onChange={onMethodChange}
            fullWidth
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField label={t('actions.action-editor.label-url', 'URL')} labelWidth={LABEL_WIDTH} grow={true}>
          <SuggestionsInput
            value={actionConfig.url}
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
        <ParamsEditor value={actionConfig.queryParams ?? []} onChange={onQueryParamsChange} suggestions={suggestions} />
      </Field>

      <Field label={t('actions.action-editor.label-headers', 'Headers')}>
        <ParamsEditor
          value={actionConfig.headers ?? []}
          onChange={onHeadersChange}
          suggestions={suggestions}
          contentTypeHeader={true}
        />
      </Field>

      {actionConfig.method !== HttpRequestMethod.GET && (
        <Field label={t('grafana-ui.action-editor.modal.action-body', 'Body')} className={styles.inputField}>
          <SuggestionsInput
            value={actionConfig.body}
            onChange={onBodyChange}
            suggestions={suggestions}
            type={HTMLElementType.TextAreaElement}
          />
        </Field>
      )}

      {shouldRenderJSON && (
        <>
          <br />
          {renderJSON(actionConfig.body)}
        </>
      )}

      <Field label={t('grafana-ui.action-editor.button.style', 'Button style')} style={{ marginTop: '8px' }}>
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
