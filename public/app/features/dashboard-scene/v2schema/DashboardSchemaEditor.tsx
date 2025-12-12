import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, CodeEditor, Spinner, useStyles2, type Monaco, type MonacoEditor } from '@grafana/ui';

import { fetchDashboardV2Schema } from './dashboardSchemaFetcher';

// CSS to ensure Monaco hover widgets appear above modal overlays
const MONACO_HOVER_STYLE_ID = 'dashboard-schema-editor-hover-fix';
const MONACO_HOVER_STYLES = `
  .monaco-hover {
    z-index: 10000 !important;
  }
  .monaco-hover-content {
    z-index: 10000 !important;
  }
  .monaco-editor-overlaymessage {
    z-index: 10000 !important;
  }
  .overflowingContentWidgets {
    z-index: 10000 !important;
  }
`;

// Interface for the fetched schema
interface JSONSchema {
  [key: string]: unknown;
}

export interface DashboardSchemaEditorProps {
  /** The JSON value to edit */
  value: string;
  /** Called when the value changes */
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
}: DashboardSchemaEditorProps) {
  const styles = useStyles2(getStyles);

  const [schema, setSchema] = useState<JSONSchema | null>(null);
  const [isSchemaLoading, setIsSchemaLoading] = useState(true);
  const [hasValidationErrors, setHasValidationErrors] = useState(false);

  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const schemaRef = useRef<JSONSchema | null>(null);
  const markerListenerDisposable = useRef<{ dispose: () => void } | null>(null);

  // Keep schema ref in sync
  schemaRef.current = schema;

  // Inject global styles to fix Monaco hover z-index
  useEffect(() => {
    if (document.getElementById(MONACO_HOVER_STYLE_ID)) {
      return;
    }
    const styleElement = document.createElement('style');
    styleElement.id = MONACO_HOVER_STYLE_ID;
    styleElement.textContent = MONACO_HOVER_STYLES;
    document.head.appendChild(styleElement);

    return () => {
      const existing = document.getElementById(MONACO_HOVER_STYLE_ID);
      if (existing) {
        existing.remove();
      }
    };
  }, []);

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
    onValidationChange?.(hasErrors);
  }, [onValidationChange]);

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
      onChange?.(newValue);
    },
    [onChange]
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
      {showValidationAlert && hasValidationErrors && (
        <div className={styles.alertContainer}>
          <Alert
            title={t(
              'dashboard-schema-editor.fix-validation-errors',
              'The JSON contains validation errors. Fix them before applying changes.'
            )}
            severity="warning"
            topSpacing={0}
            bottomSpacing={0}
          />
        </div>
      )}
      <div className={styles.editorContainer}>
        <CodeEditor
          width="100%"
          height="100%"
          value={value}
          language="json"
          showLineNumbers={showLineNumbers}
          showMiniMap={showMiniMap}
          readOnly={readOnly}
          containerStyles={styles.codeEditorContainer}
          onBeforeEditorMount={handleBeforeEditorMount}
          onEditorDidMount={handleEditorDidMount}
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
  editorContainer: css({
    flex: '1 1 0',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  }),
  codeEditorContainer: css({
    flex: '1 1 0',
    minHeight: 0,
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
