import { css } from '@emotion/css';
import { useMemo } from 'react';

import { FieldNamePickerConfigSettings, GrafanaTheme2, StandardEditorsRegistryItem, textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PositionDimensionMode, ScalarDimensionMode, TextDimensionConfig, TextDimensionMode } from '@grafana/schema';
import { CodeEditor, InlineField, InlineFieldRow, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';
import { DimensionContext } from 'app/features/dimensions/context';

import { CanvasElementItem, CanvasElementOptions, CanvasElementProps } from '../element';

// eslint-disable-next-line
const dummyFieldSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {},
} as StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings>;

// Simple hash function to generate unique scope IDs
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

// Scope CSS classes to avoid conflicts between multiple SVG elements
function scopeSvgClasses(content: string, scopeId: string): string {
  // Replace class definitions in style blocks (.classname)
  let scoped = content.replace(/\.([a-zA-Z_-][\w-]*)/g, (match, className) => {
    return `.${className}-${scopeId}`;
  });

  // Replace class attributes (class="name1 name2")
  scoped = scoped.replace(/class="([^"]+)"/g, (match, classNames) => {
    const scopedNames = classNames
      .split(/\s+/)
      .map((name: string) => (name ? `${name}-${scopeId}` : ''))
      .join(' ');
    return `class="${scopedNames}"`;
  });

  return scoped;
}

export interface SvgConfig {
  content?: TextDimensionConfig;
}

interface SvgData {
  content: string;
}

export function SvgDisplay(props: CanvasElementProps<SvgConfig, SvgData>) {
  const { data } = props;
  const styles = useStyles2(getStyles);

  // Generate unique scope ID based on content hash
  const scopeId = useMemo(() => {
    if (!data?.content) {
      return '';
    }
    return hashString(data.content);
  }, [data?.content]);

  if (!data?.content) {
    return (
      <div className={styles.placeholder}>{t('canvas.svg-element.placeholder', 'Double click to add SVG content')}</div>
    );
  }

  // Check if content already has an SVG wrapper
  const hasSvgWrapper = data.content.trim().toLowerCase().startsWith('<svg');

  // Prepare content (wrap if needed)
  let contentToScope = data.content;
  if (!hasSvgWrapper) {
    contentToScope = `<svg width="100%" height="100%">${data.content}</svg>`;
  }

  // Scope class names to prevent conflicts
  const scopedContent = scopeSvgClasses(contentToScope, scopeId);

  // Sanitize the scoped content
  const sanitizedContent = textUtil.sanitizeSVGContent(scopedContent);

  return <div className={styles.container} dangerouslySetInnerHTML={{ __html: sanitizedContent }} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '& svg': {
      width: '100%',
      height: '100%',
    },
  }),
  placeholder: css({
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'center',
    padding: theme.spacing(1),
    border: `1px dashed ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});

export const svgItem: CanvasElementItem<SvgConfig, SvgData> = {
  id: 'svg',
  name: 'SVG',
  description: 'Generic SVG element with sanitized content',

  display: SvgDisplay,

  hasEditMode: false,

  defaultSize: {
    width: 100,
    height: 100,
  },

  getNewOptions: (options) => ({
    ...options,
    config: {
      content: {
        mode: TextDimensionMode.Fixed,
        fixed: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="currentColor" /></svg>',
      },
    },
    background: {
      color: {
        fixed: 'transparent',
      },
    },
    placement: {
      width: options?.placement?.width ?? { fixed: 100, mode: PositionDimensionMode.Fixed },
      height: options?.placement?.height ?? { fixed: 100, mode: PositionDimensionMode.Fixed },
      top: options?.placement?.top ?? { fixed: 100, mode: PositionDimensionMode.Fixed },
      left: options?.placement?.left ?? { fixed: 100, mode: PositionDimensionMode.Fixed },
      rotation: options?.placement?.rotation ?? { fixed: 0, mode: ScalarDimensionMode.Clamped, min: 0, max: 360 },
    },
    links: options?.links ?? [],
  }),

  prepareData: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<SvgConfig>) => {
    const svgConfig = elementOptions.config;

    const data: SvgData = {
      content: svgConfig?.content ? dimensionContext.getText(svgConfig.content).value() : '',
    };

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = [t('canvas.svg-element.category', 'SVG')];

    builder.addCustomEditor({
      category,
      id: 'svgContent',
      path: 'config.content',
      name: t('canvas.svg-element.content', 'SVG Content'),
      description: t('canvas.svg-element.content-description', 'Enter SVG content or select a field.'),
      editor: ({ value, onChange, context }) => {
        const mode = value?.mode ?? TextDimensionMode.Fixed;
        const labelWidth = 9;

        const modeOptions = [
          {
            label: t('canvas.svg-element.mode-fixed', 'Fixed'),
            value: TextDimensionMode.Fixed,
            description: t('canvas.svg-element.mode-fixed-description', 'Manually enter SVG content'),
          },
          {
            label: t('canvas.svg-element.mode-field', 'Field'),
            value: TextDimensionMode.Field,
            description: t('canvas.svg-element.mode-field-description', 'SVG content from data source field'),
          },
        ];

        const onModeChange = (newMode: TextDimensionMode) => {
          onChange({
            ...value,
            mode: newMode,
          });
        };

        const onFieldChange = (field?: string) => {
          onChange({
            ...value,
            field,
          });
        };

        const onFixedChange = (newValue: string) => {
          onChange({
            ...value,
            mode: TextDimensionMode.Fixed,
            fixed: newValue,
          });
        };

        return (
          <>
            <InlineFieldRow>
              <InlineField label={t('canvas.svg-element.source', 'Source')} labelWidth={labelWidth} grow={true}>
                <RadioButtonGroup value={mode} options={modeOptions} onChange={onModeChange} fullWidth />
              </InlineField>
            </InlineFieldRow>

            {mode === TextDimensionMode.Field && (
              <InlineFieldRow>
                <InlineField label={t('canvas.svg-element.field', 'Field')} labelWidth={labelWidth} grow={true}>
                  <FieldNamePicker
                    context={context}
                    value={value?.field ?? ''}
                    onChange={onFieldChange}
                    item={dummyFieldSettings}
                  />
                </InlineField>
              </InlineFieldRow>
            )}

            {mode === TextDimensionMode.Fixed && (
              <div style={{ marginTop: '8px' }}>
                <CodeEditor
                  value={value?.fixed || ''}
                  language="xml"
                  height="200px"
                  onBlur={onFixedChange}
                  monacoOptions={{
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    folding: false,
                    renderLineHighlight: 'none',
                    overviewRulerBorder: false,
                    hideCursorInOverviewRuler: true,
                    overviewRulerLanes: 0,
                  }}
                />
              </div>
            )}
          </>
        );
      },
      settings: {},
    });
  },
};
