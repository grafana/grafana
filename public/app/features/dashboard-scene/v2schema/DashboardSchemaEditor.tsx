import { css } from '@emotion/css';
import yaml from 'js-yaml';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  CodeEditor,
  RadioButtonGroup,
  Spinner,
  Stack,
  Tooltip,
  useStyles2,
  type Monaco,
  type MonacoEditor,
} from '@grafana/ui';

import { fetchDashboardSchema } from './dashboardSchemaFetcher';

export type SchemaEditorFormat = 'json' | 'yaml';

interface JSONSchema {
  [key: string]: unknown;
}

const SCHEMA_URI = 'http://grafana.com/schemas/dashboard-v2beta1.json';

export interface DashboardSchemaEditorProps {
  /** The JSON value to edit */
  value: string;
  /** Called when the value changes (value is always JSON regardless of display format) */
  onChange?: (value: string) => void;
  onValidationChange?: (hasErrors: boolean) => void;
  readOnly?: boolean;
  containerStyles?: string;
  showFormatToggle?: boolean;
  initialFormat?: SchemaEditorFormat;
  onFormatChange?: (format: SchemaEditorFormat) => void;
}

export function DashboardSchemaEditor({
  value,
  onChange,
  onValidationChange,
  readOnly = false,
  containerStyles,
  showFormatToggle = false,
  initialFormat = 'json',
  onFormatChange,
}: DashboardSchemaEditorProps) {
  const styles = useStyles2(getStyles);

  const [schema, setSchema] = useState<JSONSchema | null>(null);
  const [isSchemaLoading, setIsSchemaLoading] = useState(true);
  const [format, setFormat] = useState<SchemaEditorFormat>(initialFormat);
  const [yamlParseError, setYamlParseError] = useState<string | null>(null);
  const [localYamlContent, setLocalYamlContent] = useState<string | null>(null);

  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const schemaRef = useRef<JSONSchema | null>(null);
  const disposablesRef = useRef<{ dispose: () => void } | null>(null);

  schemaRef.current = schema;

  const formatOptions: Array<{ label: string; value: SchemaEditorFormat }> = [
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    { label: 'JSON', value: 'json' },
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    { label: 'YAML', value: 'yaml' },
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

  const handleFormatChange = useCallback(
    (newFormat: SchemaEditorFormat) => {
      if (newFormat === 'yaml' && !isValidJson(value)) {
        return;
      }
      if (newFormat === 'json' && localYamlContent !== null) {
        try {
          onChange?.(JSON.stringify(yaml.load(localYamlContent), null, 2));
        } catch (e) {
          setYamlParseError(e instanceof Error ? e.message : 'Invalid YAML');
          onValidationChange?.(true);
          return;
        }
      }
      setFormat(newFormat);
      setYamlParseError(null);
      setLocalYamlContent(null);
      onValidationChange?.(false);
      onFormatChange?.(newFormat);
    },
    [localYamlContent, value, onChange, onValidationChange, onFormatChange]
  );

  useEffect(() => {
    fetchDashboardSchema()
      .then((s) => {
        setSchema(s);
        setIsSchemaLoading(false);
      })
      .catch(() => setIsSchemaLoading(false));
  }, []);

  const checkValidationErrors = useCallback(() => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!monaco || !model) {
      return;
    }
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    const hasErrors = markers.some((m) => m.severity === monaco.MarkerSeverity.Error);
    onValidationChange?.(hasErrors);
  }, [onValidationChange]);

  useEffect(() => {
    if (yamlParseError) {
      onValidationChange?.(true);
    }
  }, [yamlParseError, onValidationChange]);

  // Validate YAML by creating a hidden JSON model with schema validation
  useEffect(() => {
    if (format !== 'yaml' || yamlParseError || !schema) {
      return;
    }
    let disposed = false;
    import('monaco-editor').then((monaco) => {
      if (disposed) {
        return;
      }
      const uri = monaco.Uri.parse('inmemory://yaml-validation-' + Date.now() + '.json');
      const tempModel = monaco.editor.createModel(value, 'json', uri);
      configureSchemaDiagnostics(monaco, schema);

      setTimeout(() => {
        if (!disposed) {
          const markers = monaco.editor.getModelMarkers({ resource: tempModel.uri });
          onValidationChange?.(markers.some((m) => m.severity === monaco.MarkerSeverity.Error));
        }
        tempModel.dispose();
      }, 150);
    });
    return () => {
      disposed = true;
    };
  }, [format, yamlParseError, schema, value, onValidationChange]);

  const handleEditorDidMount = useCallback(
    (editor: MonacoEditor, monaco: Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      if (schemaRef.current) {
        configureSchemaDiagnostics(monaco, schemaRef.current);
      }

      const markerListener = monaco.editor.onDidChangeMarkers((uris) => {
        const model = editor.getModel();
        if (model && uris.some((u) => u.toString() === model.uri.toString())) {
          checkValidationErrors();
        }
      });
      const contentListener = editor.onDidChangeModelContent(() => {
        setTimeout(checkValidationErrors, 200);
      });

      disposablesRef.current = {
        dispose: () => {
          markerListener.dispose();
          contentListener.dispose();
        },
      };

      setTimeout(checkValidationErrors, 100);
    },
    [checkValidationErrors]
  );

  useEffect(() => () => disposablesRef.current?.dispose(), []);

  const handleChange = useCallback(
    (newValue: string) => {
      if (format === 'json') {
        setYamlParseError(null);
        setLocalYamlContent(null);
        onChange?.(newValue);
        return;
      }
      setLocalYamlContent(newValue);
      try {
        setYamlParseError(null);
        onChange?.(JSON.stringify(yaml.load(newValue), null, 2));
      } catch (e) {
        setYamlParseError(e instanceof Error ? e.message : 'Invalid YAML');
        onValidationChange?.(true);
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

  return (
    <div className={wrapperClassName}>
      {showFormatToggle && (
        <div className={styles.formatToggleContainer}>
          <Stack direction="row" gap={1} alignItems="center">
            <span className={styles.formatLabel}>{t('dashboard-schema-editor.format-label', 'Format:')}</span>
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
                  size="sm"
                />
              </div>
            </Tooltip>
          </Stack>
        </div>
      )}
      <div className={styles.editorContainer}>
        <CodeEditor
          key={format}
          width="100%"
          height="100%"
          value={displayValue}
          language={format}
          showLineNumbers={true}
          showMiniMap={true}
          readOnly={readOnly}
          containerStyles={styles.codeEditorContainer}
          onBeforeEditorMount={(monaco) => {
            monacoRef.current = monaco;
          }}
          onEditorDidMount={format === 'json' ? handleEditorDidMount : undefined}
          onChange={handleChange}
          monacoOptions={{ hover: { enabled: true, delay: 300 }, overviewRulerLanes: 3, fixedOverflowWidgets: false }}
        />
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

function configureSchemaDiagnostics(monaco: typeof import('monaco-editor'), schema: JSONSchema): void {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    schemaValidation: 'error',
    schemas: [{ uri: SCHEMA_URI, fileMatch: ['*'], schema }],
  });
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
});
