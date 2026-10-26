import { css } from '@emotion/css';
import yaml from 'js-yaml';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, RadioButtonGroup, Spinner, Stack, Tooltip, useStyles2, CodeMirrorEditor } from '@grafana/ui';

import { fetchDashboardSchema } from './dashboardSchemaFetcher';
import { parseDashboardSchema } from './dashboardSchemaParser';

export type SchemaEditorFormat = 'json' | 'yaml';

export interface DashboardSchemaEditorProps {
  /** The JSON value to edit */
  value: string;
  /** Called when the value changes (value is always JSON regardless of display format) */
  onChange?: (value: string) => void;
  onValidationChange?: (hasErrors: boolean) => void;
  /** Reports whether the current buffer has a syntax error (YAML that does not parse to JSON) */
  onParseErrorChange?: (hasParseError: boolean) => void;
  readOnly?: boolean;
  containerStyles?: string;
  showFormatToggle?: boolean;
  initialFormat?: SchemaEditorFormat;
  onFormatChange?: (format: SchemaEditorFormat) => void;
  /** Rendered right-aligned in the header row */
  headerActions?: ReactNode;
  /** Rendered on the left side of the header row, next to the format toggle */
  headerLeftActions?: ReactNode;
  /** When set, replaces the code editor area while the header row (format toggle, actions) stays visible */
  contentOverride?: ReactNode;
}

export function DashboardSchemaEditor({
  value,
  onChange,
  onValidationChange,
  onParseErrorChange,
  readOnly = false,
  containerStyles,
  showFormatToggle = false,
  initialFormat = 'json',
  onFormatChange,
  headerActions,
  headerLeftActions,
  contentOverride,
}: DashboardSchemaEditorProps) {
  const styles = useStyles2(getStyles);

  // Settings routes also import this component, so load schema tooling only when it mounts.
  const {
    value: schemaState,
    loading: isSchemaLoading,
    error: schemaLoadError,
  } = useAsync(async () => {
    const [schema, support] = await Promise.all([
      fetchDashboardSchema().catch(() => null),
      import('./dashboardSchemaExtensions'),
    ]);
    return { schema, support };
  }, []);
  const [format, setFormat] = useState<SchemaEditorFormat>(initialFormat);
  const [yamlParseError, setYamlParseError] = useState<string | null>(null);
  const [localYamlContent, setLocalYamlContent] = useState<string | null>(null);

  const formatOptions: Array<{ label: string; value: SchemaEditorFormat }> = [
    { label: t('dashboard-scene.resource-export.label.json', 'JSON'), value: 'json' },
    { label: t('dashboard-scene.resource-export.label.yaml', 'YAML'), value: 'yaml' },
  ];

  const jsonInvalid = format === 'json' && !isValidJson(value);
  // Prevent switching formats when the current content has syntax errors
  const disabledFormats = yamlParseError ? ['json' as const] : jsonInvalid ? ['yaml' as const] : undefined;

  const displayValue = useMemo(() => {
    if (format === 'json') {
      return value;
    }
    if (localYamlContent !== null) {
      return localYamlContent;
    }
    try {
      return yaml.dump(JSON.parse(value), { indent: 2, lineWidth: -1, noRefs: true });
    } catch {
      return value;
    }
  }, [value, format, localYamlContent]);

  const validate = useMemo(
    () => schemaState?.support.createDashboardSchemaValidator(schemaState.schema ?? {}),
    [schemaState]
  );
  const extensions = useMemo(
    () => schemaState?.support.createDashboardSchemaExtensions(schemaState.schema ?? {}, { format, validate }) ?? [],
    [schemaState, format, validate]
  );

  // Diff/content overrides unmount the editor, so validation belongs to the buffer,
  // rather than the lifetime of a CodeMirror view.
  useEffect(() => {
    onValidationChange?.(true);
    if (isSchemaLoading || !validate) {
      return;
    }
    const timeout = setTimeout(() => onValidationChange?.(validate(displayValue, format).hasErrors), 100);
    return () => clearTimeout(timeout);
  }, [displayValue, format, isSchemaLoading, validate, onValidationChange]);

  const handleFormatChange = useCallback(
    (newFormat: SchemaEditorFormat) => {
      if (!validate) {
        return;
      }
      if (newFormat === 'yaml' && !isValidJson(value)) {
        return;
      }
      if (newFormat === 'json' && localYamlContent !== null) {
        const result = parseDashboardSchema(localYamlContent, 'yaml');
        if (result.hasParseError) {
          setYamlParseError(result.error);
          onValidationChange?.(true);
          return;
        }
        onChange?.(result.json);
      }
      onValidationChange?.(true);
      setFormat(newFormat);
      setYamlParseError(null);
      setLocalYamlContent(null);
      onFormatChange?.(newFormat);
    },
    [localYamlContent, value, onChange, onValidationChange, onFormatChange, validate]
  );

  // A YAML parse error means `value` no longer reflects the buffer on screen.
  useEffect(() => {
    onParseErrorChange?.(yamlParseError !== null);
  }, [yamlParseError, onParseErrorChange]);

  const handleChange = useCallback(
    (newValue: string) => {
      if (!validate) {
        return;
      }
      if (newValue !== displayValue) {
        onValidationChange?.(true);
      }
      if (format === 'json') {
        setYamlParseError(null);
        setLocalYamlContent(null);
        onChange?.(newValue);
        return;
      }
      setLocalYamlContent(newValue);
      const result = parseDashboardSchema(newValue, 'yaml');
      if (result.hasParseError) {
        setYamlParseError(result.error);
        return;
      }
      setYamlParseError(null);
      onChange?.(result.json);
    },
    [displayValue, format, onChange, onValidationChange, validate]
  );

  const wrapperClassName = containerStyles ? `${styles.wrapper} ${containerStyles}` : styles.wrapper;

  if (isSchemaLoading) {
    return (
      <div className={wrapperClassName}>
        <div className={styles.loadingContainer}>
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClassName}>
      {schemaLoadError && (
        <Alert
          severity="error"
          title={t('dashboard-schema-editor.schema-load-error', 'Unable to load dashboard schema validation')}
        >
          {t('dashboard-schema-editor.schema-load-error-description', 'Reload the page to edit this dashboard.')}
        </Alert>
      )}
      {(showFormatToggle || headerLeftActions || headerActions) && (
        <div className={styles.formatToggleContainer}>
          {(showFormatToggle || headerLeftActions) && (
            <Stack direction="row" gap={1} alignItems="center">
              {showFormatToggle && (
                <Tooltip
                  content={
                    yamlParseError
                      ? t('dashboard-schema-editor.json-disabled-tooltip', 'Fix YAML syntax errors to switch to JSON')
                      : t('dashboard-schema-editor.yaml-disabled-tooltip', 'Fix JSON syntax errors to switch to YAML')
                  }
                  show={disabledFormats ? undefined : false}
                  placement="top"
                >
                  <div>
                    <RadioButtonGroup
                      options={formatOptions}
                      value={format}
                      onChange={handleFormatChange}
                      disabledOptions={disabledFormats}
                      disabled={Boolean(schemaLoadError)}
                    />
                  </div>
                </Tooltip>
              )}
              {headerLeftActions}
            </Stack>
          )}
          {headerActions && <div className={styles.headerActions}>{headerActions}</div>}
        </div>
      )}
      <div className={styles.editorContainer}>
        {contentOverride ?? (
          <div className={styles.codeEditorContainer}>
            <CodeMirrorEditor
              key={format}
              height="100%"
              value={displayValue}
              language={format}
              extensions={extensions}
              readOnly={readOnly || Boolean(schemaLoadError)}
              aria-label={t('dashboard-schema-editor.editor-label', 'Dashboard schema')}
              onChange={handleChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    gap: theme.spacing(1),
  }),
  formatToggleContainer: css({
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
  headerActions: css({
    marginLeft: 'auto',
  }),
  editorContainer: css({
    flex: '1 1 0',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  }),
  codeEditorContainer: css({
    height: '100%',
    flex: '1 1 0',
    minHeight: 0,
    overflow: 'visible',
    '.cm-theme': {
      height: '100%',
    },
  }),
  loadingContainer: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: theme.colors.text.secondary,
  }),
});
