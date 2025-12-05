import { css } from '@emotion/css';

import { GrafanaTheme2, textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PositionDimensionMode, ScalarDimensionMode, TextDimensionConfig, TextDimensionMode } from '@grafana/schema';
import { CodeEditor, useStyles2 } from '@grafana/ui';
import { DimensionContext } from 'app/features/dimensions/context';

import { CanvasElementItem, CanvasElementOptions, CanvasElementProps } from '../element';

export interface SvgConfig {
  content?: TextDimensionConfig;
}

interface SvgData {
  content: string;
}

export function SvgDisplay(props: CanvasElementProps<SvgConfig, SvgData>) {
  const { data } = props;
  const styles = useStyles2(getStyles);

  if (!data?.content) {
    return (
      <div className={styles.placeholder}>{t('canvas.svg-element.placeholder', 'Double click to add SVG content')}</div>
    );
  }

  // Check if content already has an SVG wrapper
  const hasSvgWrapper = data.content.trim().toLowerCase().startsWith('<svg');

  let sanitizedContent: string;

  if (hasSvgWrapper) {
    // Content already has SVG wrapper, sanitize as-is
    sanitizedContent = textUtil.sanitizeSVGContent(data.content);
  } else {
    // Content is a fragment - wrap in SVG before sanitizing
    const wrappedContent = `<svg width="100%" height="100%">${data.content}</svg>`;
    sanitizedContent = textUtil.sanitizeSVGContent(wrappedContent);
  }

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
      description: t('canvas.svg-element.content-description', 'Enter SVG content.'),
      editor: ({ value, onChange }) => {
        const currentValue = value?.fixed || '';

        return (
          <CodeEditor
            value={currentValue}
            language="xml"
            height="200px"
            onBlur={(newValue) => {
              onChange({
                ...value,
                mode: TextDimensionMode.Fixed,
                fixed: newValue,
              });
            }}
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
        );
      },
      settings: {},
    });
  },
};
