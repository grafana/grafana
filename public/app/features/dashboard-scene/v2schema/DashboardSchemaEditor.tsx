import { css } from '@emotion/css';
import yaml from 'js-yaml';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  CodeEditor,
  RadioButtonGroup,
  Spinner,
  Stack,
  useStyles2,
  type Monaco,
  type MonacoEditor,
} from '@grafana/ui';

import { fetchDashboardV2Schema } from './dashboardSchemaFetcher';

export type EditorFormat = 'json' | 'yaml';

// Interface for the fetched schema
interface JSONSchema {
  [key: string]: unknown;
}

export interface DashboardSchemaEditorProps {
  /** The JSON value to edit (always in JSON format internally) */
  value: string;
  /** Called when the value changes (always returns JSON format) */
  onChange?: (value: string) => void;
  /** Called when validation state changes */
  onValidationChange?: (hasErrors: boolean) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Custom container styles for the code editor */
  containerStyles?: string;
  /** Whether to show the minimap (default: true) */
  showMiniMap?: boolean;
  /** Whether to show line numbers (default: true) */
  showLineNumbers?: boolean;
  /** Whether to show the validation error alert above the editor (default: true) */
  showValidationAlert?: boolean;
  /** Whether to show the format toggle (JSON/YAML) (default: false) */
  showFormatToggle?: boolean;
  /** Initial format (default: 'json') */
  initialFormat?: EditorFormat;
}

/**
 * A reusable JSON editor component with dashboard v2 schema validation.
 * Provides real-time validation against the dashboard v2beta1 schema with
 * inline error highlighting and hover tooltips.
 */
export function DashboardSchemaEditor({
  value,
  onChange,
  onValidationChange,
  readOnly = false,
  containerStyles,
  showMiniMap = true,
  showLineNumbers = true,
  showValidationAlert = true,
  showFormatToggle = false,
  initialFormat = 'json',
}: DashboardSchemaEditorProps) {
  const styles = useStyles2(getStyles);

  const [schema, setSchema] = useState<JSONSchema | null>(null);
  const [isSchemaLoading, setIsSchemaLoading] = useState(true);
  const [hasValidationErrors, setHasValidationErrors] = useState(false);
  const [format, setFormat] = useState<EditorFormat>(initialFormat);
  const [yamlParseError, setYamlParseError] = useState<string | null>(null);
  // Track local editor content for YAML mode (to preserve content even when invalid)
  const [localYamlContent, setLocalYamlContent] = useState<string | null>(null);

  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const schemaRef = useRef<JSONSchema | null>(null);
  const markerListenerDisposable = useRef<{ dispose: () => void } | null>(null);

  // Keep schema ref in sync
  schemaRef.current = schema;

  // Format toggle options
  const formatOptions: Array<{ label: string; value: EditorFormat }> = useMemo(
    () => [
      { label: t('dashboard-schema-editor.format.json', 'JSON'), value: 'json' },
      { label: t('dashboard-schema-editor.format.yaml', 'YAML'), value: 'yaml' },
    ],
    []
  );

  // Convert JSON value to display format
  const displayValue = useMemo(() => {
    if (format === 'json') {
      return value;
    }
    // In YAML mode, use local content if available (preserves edits even when invalid)
    if (localYamlContent !== null) {
      return localYamlContent;
    }
    // Otherwise convert from JSON
    try {
      const parsed = JSON.parse(value);
      return yaml.dump(parsed, { indent: 2, lineWidth: -1, noRefs: true });
    } catch {
      // If JSON is invalid, return as-is
      return value;
    }
  }, [value, format, localYamlContent]);

  // Handle format change
  const handleFormatChange = useCallback(
    (newFormat: EditorFormat) => {
      if (newFormat === 'json' && localYamlContent !== null) {
        // Switching from YAML to JSON - try to convert current YAML content
        try {
          const parsed = yaml.load(localYamlContent);
          const jsonValue = JSON.stringify(parsed, null, 2);
          onChange?.(jsonValue);
        } catch (e) {
          // Can't convert - show error
          const message = e instanceof Error ? e.message : 'Invalid YAML';
          setYamlParseError(message);
          onValidationChange?.(true);
          // Don't switch format if YAML is invalid
          return;
        }
      }
      // Reset all validation state when switching formats
      setFormat(newFormat);
      setYamlParseError(null);
      setHasValidationErrors(false);
      setLocalYamlContent(null);
      onValidationChange?.(false);
    },
    [localYamlContent, onChange, onValidationChange]
  );

  // Fetch schema on mount
  useEffect(() => {
    fetchDashboardV2Schema()
      .then((fetchedSchema) => {
        setSchema(fetchedSchema);
        setIsSchemaLoading(false);
      })
      .catch(() => {
        setIsSchemaLoading(false);
        // Allow editing even if schema fails to load
        setHasValidationErrors(false);
      });
  }, []);

  // Reset local YAML content when value changes from outside
  // This handles cases like successful save where the parent updates the value
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      // Only reset if the change came from outside (not from our own handleChange)
      if (format === 'yaml' && localYamlContent !== null) {
        // Check if the new value matches what we'd get from our local YAML
        try {
          const parsed = yaml.load(localYamlContent);
          const jsonFromYaml = JSON.stringify(parsed, null, 2);
          if (jsonFromYaml !== value) {
            // Value changed from outside, reset local content
            setLocalYamlContent(null);
            setYamlParseError(null);
          }
        } catch {
          // If we can't parse local YAML, don't reset (user is still editing)
        }
      }
    }
  }, [value, format, localYamlContent]);

  // Check for validation errors using Monaco markers
  const checkValidationErrors = useCallback(() => {
    if (!monacoRef.current || !editorRef.current) {
      return;
    }

    const editorModel = editorRef.current.getModel();
    if (!editorModel) {
      return;
    }

    const monaco = monacoRef.current;
    const markers = monaco.editor.getModelMarkers({ resource: editorModel.uri });
    const errorMarkers = markers.filter((marker) => marker.severity === monaco.MarkerSeverity.Error);
    const hasErrors = errorMarkers.length > 0;

    setHasValidationErrors(hasErrors);
    // Include YAML parse errors in the validation state
    onValidationChange?.(hasErrors);
  }, [onValidationChange]);

  // Update validation state when YAML parse error changes
  useEffect(() => {
    if (yamlParseError) {
      onValidationChange?.(true);
    }
  }, [yamlParseError, onValidationChange]);

  // Validate YAML content using a hidden JSON model (simplified - just sets hasValidationErrors flag)
  useEffect(() => {
    // Only run in YAML mode with valid YAML (no parse error) and with schema loaded
    if (format !== 'yaml' || yamlParseError || !schema) {
      return;
    }

    // We need Monaco instance - use dynamic import to get it
    let disposed = false;
    import('monaco-editor').then((monaco) => {
      if (disposed) {
        return;
      }

      // Create a temporary model for validation
      const uri = monaco.Uri.parse('inmemory://yaml-validation-' + Date.now() + '.json');
      const tempModel = monaco.editor.createModel(value, 'json', uri);

      // Configure JSON schema for validation
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemaValidation: 'error',
        schemas: [
          {
            uri: 'http://grafana.com/schemas/dashboard-v2beta1.json',
            fileMatch: ['*'],
            schema: schema,
          },
        ],
      });

      // Check for markers after a delay (Monaco validates async)
      const checkMarkers = () => {
        if (disposed) {
          tempModel.dispose();
          return;
        }
        const markers = monaco.editor.getModelMarkers({ resource: tempModel.uri });
        const errorMarkers = markers.filter((m) => m.severity === monaco.MarkerSeverity.Error);
        const hasErrors = errorMarkers.length > 0;

        setHasValidationErrors(hasErrors);
        onValidationChange?.(hasErrors);

        // Dispose the temp model after checking
        tempModel.dispose();
      };

      setTimeout(checkMarkers, 150);
    });

    return () => {
      disposed = true;
    };
  }, [format, yamlParseError, schema, value, onValidationChange]);

  const handleBeforeEditorMount = useCallback((monaco: Monaco) => {
    monacoRef.current = monaco;
  }, []);

  const handleEditorDidMount = useCallback(
    (editor: MonacoEditor, monaco: Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Configure schema validation after editor is mounted
      if (schemaRef.current) {
        try {
          monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            validate: true,
            allowComments: false,
            schemaValidation: 'error',
            schemas: [
              {
                uri: 'http://grafana.com/schemas/dashboard-v2beta1.json',
                fileMatch: ['*'],
                schema: schemaRef.current,
              },
            ],
          });
        } catch {
          // Silently handle schema configuration errors
        }
      }

      // Listen for marker changes (validation results)
      const markerListener = monaco.editor.onDidChangeMarkers((uris) => {
        const model = editor.getModel();
        if (model && uris.some((uri) => uri.toString() === model.uri.toString())) {
          checkValidationErrors();
        }
      });

      // Listen for content changes
      const contentListener = editor.onDidChangeModelContent(() => {
        setTimeout(checkValidationErrors, 200);
      });

      markerListenerDisposable.current = {
        dispose: () => {
          markerListener.dispose();
          contentListener.dispose();
        },
      };

      // Initial check
      setTimeout(checkValidationErrors, 100);
    },
    [checkValidationErrors]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markerListenerDisposable.current?.dispose();
    };
  }, []);

  const handleChange = useCallback(
    (newValue: string) => {
      if (format === 'json') {
        setYamlParseError(null);
        setLocalYamlContent(null);
        onChange?.(newValue);
      } else {
        // YAML mode - always store local content
        setLocalYamlContent(newValue);

        // Try to convert to JSON
        try {
          const parsed = yaml.load(newValue);
          const jsonValue = JSON.stringify(parsed, null, 2);
          setYamlParseError(null);
          onChange?.(jsonValue);
        } catch (e) {
          // YAML parse error - show error
          const message = e instanceof Error ? e.message : 'Invalid YAML';
          setYamlParseError(message);
          // Report as validation error
          onValidationChange?.(true);
        }
      }
    },
    [format, onChange, onValidationChange]
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

  // Determine if there are any errors to show
  const hasErrors = hasValidationErrors || !!yamlParseError;
  const errorMessage = yamlParseError
    ? t('dashboard-schema-editor.yaml-parse-error', 'Invalid YAML syntax: {{error}}', { error: yamlParseError })
    : t(
        'dashboard-schema-editor.fix-validation-errors',
        'The document contains validation errors. Fix them before applying changes.'
      );

  return (
    <div className={wrapperClassName}>
      {showFormatToggle && (
        <div className={styles.formatToggleContainer}>
          <Stack direction="row" gap={1} alignItems="center">
            <span className={styles.formatLabel}>{t('dashboard-schema-editor.format-label', 'Format:')}</span>
            <RadioButtonGroup options={formatOptions} value={format} onChange={handleFormatChange} size="sm" />
          </Stack>
        </div>
      )}
      {showValidationAlert && hasErrors && (
        <div className={styles.alertContainer}>
          <Alert title={errorMessage} severity="warning" topSpacing={0} bottomSpacing={0} />
        </div>
      )}
      <div className={styles.editorContainer}>
        <CodeEditor
          key={format} // Force remount when format changes to reinitialize schema validation
          width="100%"
          height="100%"
          value={displayValue}
          language={format}
          showLineNumbers={showLineNumbers}
          showMiniMap={showMiniMap}
          readOnly={readOnly}
          containerStyles={styles.codeEditorContainer}
          onBeforeEditorMount={format === 'json' ? handleBeforeEditorMount : undefined}
          onEditorDidMount={format === 'json' ? handleEditorDidMount : undefined}
          onChange={handleChange}
          monacoOptions={{
            hover: {
              enabled: true,
              delay: 300,
            },
            overviewRulerLanes: 3,
            fixedOverflowWidgets: false,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Hook to use the dashboard schema editor's validation state.
 * Returns whether the editor has validation errors.
 */
export function useDashboardSchemaValidation() {
  const [hasErrors, setHasErrors] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardV2Schema()
      .then(() => setIsLoading(false))
      .catch(() => setIsLoading(false));
  }, []);

  return {
    hasErrors,
    isLoading,
    onValidationChange: setHasErrors,
  };
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
  }),
  formatLabel: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  editorContainer: css({
    flex: '1 1 0',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  }),
  codeEditorContainer: css({
    flex: '1 1 0',
    minHeight: 0,
    overflow: 'visible',
  }),
  loadingContainer: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: theme.colors.text.secondary,
  }),
  // Alert should not grow, only take its natural size
  alertContainer: css({
    flex: '0 0 auto',
  }),
});
