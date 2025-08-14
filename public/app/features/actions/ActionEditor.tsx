import { css } from '@emotion/css';
import { memo } from 'react';

import {
  Action,
  ActionType,
  ActionVariable,
  DataSourceInstanceSettings,
  GrafanaTheme2,
  httpMethodOptions,
  HttpRequestMethod,
  VariableSuggestion,
  ProxyOptions,
  FetchOptions,
  SupportedDataSourceTypes,
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

  const getActionConfig = (): FetchOptions | ProxyOptions => {
    if (value.type === ActionType.Proxy) {
      return (
        value[ActionType.Proxy] || {
          ...DEFAULT_HTTP_CONFIG,
          datasourceUid: '',
          datasourceType: SupportedDataSourceTypes.Infinity,
        }
      );
    }

    return value[ActionType.Fetch] || DEFAULT_HTTP_CONFIG;
  };

  const updateActionConfig = (updates: Partial<FetchOptions | ProxyOptions>) => {
    const configKey = value.type === ActionType.Proxy ? ActionType.Proxy : ActionType.Fetch;
    const baseConfig = getActionConfig();

    // @TODO revisit
    const isProxyConfig = (config: FetchOptions | ProxyOptions): config is ProxyOptions =>
      configKey === ActionType.Proxy && 'datasourceUid' in config;

    if (isProxyConfig(baseConfig)) {
      const proxyConfig = baseConfig;
      const updatedConfig = {
        ...proxyConfig,
        ...updates,
        datasourceType: SupportedDataSourceTypes.Infinity,
        datasourceUid: proxyConfig.datasourceUid || '',
      };
      onChange(index, {
        ...value,
        [configKey]: updatedConfig,
      });
    } else {
      const updatedConfig = {
        ...baseConfig,
        ...updates,
      };
      onChange(index, {
        ...value,
        [configKey]: updatedConfig,
      });
    }
  };

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
    updateActionConfig({ url });
  };

  const onBodyChange = (body: string) => {
    updateActionConfig({ body });
  };

  const onMethodChange = (method: HttpRequestMethod) => {
    updateActionConfig({ method });
  };

  const onVariablesChange = (variables: ActionVariable[]) => {
    onChange(index, {
      ...value,
      variables,
    });
  };

  const onQueryParamsChange = (queryParams: Array<[string, string]>) => {
    updateActionConfig({ queryParams });
  };

  const onHeadersChange = (headers: Array<[string, string]>) => {
    updateActionConfig({ headers });
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

  const onConnectionChange = (connectionType: 'direct' | DataSourceInstanceSettings) => {
    if (connectionType === 'direct') {
      onChange(index, {
        ...value,
        type: ActionType.Fetch,
        [ActionType.Fetch]: getActionConfig(),
      });
    } else {
      onChange(index, {
        ...value,
        type: ActionType.Proxy,
        [ActionType.Proxy]: {
          ...getActionConfig(),
          datasourceUid: connectionType.uid,
          datasourceType: SupportedDataSourceTypes.Infinity,
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
            datasourceUid={value?.[ActionType.Proxy]?.datasourceUid}
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
