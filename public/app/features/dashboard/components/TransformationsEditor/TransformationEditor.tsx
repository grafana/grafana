import { css } from '@emotion/css';
import { createElement, useMemo } from 'react';

import { DataFrame, DataTransformerConfig, GrafanaTheme2, TransformerRegistryItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Icon, JSONFormatter, useStyles2, Drawer } from '@grafana/ui';

import { TransformationsEditorTransformation } from './types';

interface TransformationEditorProps {
  input: DataFrame[];
  output: DataFrame[];
  debugMode?: boolean;
  index: number;
  uiConfig: TransformerRegistryItem;
  configs: TransformationsEditorTransformation[];
  onChange: (index: number, config: DataTransformerConfig) => void;
  toggleShowDebug: () => void;
}

export const TransformationEditor = ({
  input,
  output,
  debugMode,
  index,
  uiConfig,
  configs,
  onChange,
  toggleShowDebug,
}: TransformationEditorProps) => {
  const styles = useStyles2(getStyles);
  const config = useMemo(() => configs[index], [configs, index]);

  const editor = useMemo(
    () =>
      createElement(uiConfig.editor, {
        options: { ...uiConfig.transformation.defaultOptions, ...config.transformation.options },
        input,
        onChange: (opts) => {
          onChange(index, {
            ...config.transformation,
            options: opts,
          });
        },
      }),
    [uiConfig.editor, uiConfig.transformation.defaultOptions, config.transformation, input, onChange, index]
  );

  return (
    <div data-testid={selectors.components.TransformTab.transformationEditor(uiConfig.name)}>
      {editor}
      {debugMode && (
        <Drawer
          title={t('dashboard.transformation-editor.title-debug-transformation', 'Debug transformation')}
          subtitle={uiConfig.name}
          onClose={toggleShowDebug}
        >
          <div
            className={styles.debugWrapper}
            data-testid={selectors.components.TransformTab.transformationEditorDebugger(uiConfig.name)}
          >
            <div className={styles.debug}>
              <div className={styles.debugTitle}>
                <Trans i18nKey="dashboard.transformation-editor.input-data">Input data</Trans>
              </div>
              <div className={styles.debugJson}>
                <JSONFormatter json={input} />
              </div>
            </div>
            <div className={styles.debugSeparator}>
              <Icon name="arrow-right" />
            </div>
            <div className={styles.debug}>
              <div className={styles.debugTitle}>
                <Trans i18nKey="dashboard.transformation-editor.output-data">Output data</Trans>
              </div>
              <div className={styles.debugJson}>{output && <JSONFormatter json={output} />}</div>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    debugWrapper: css({
      display: 'flex',
      flexDirection: 'row',
    }),
    debugSeparator: css({
      width: '48px',
      minHeight: '300px',
      display: 'flex',
      alignItems: 'center',
      alignSelf: 'stretch',
      justifyContent: 'center',
      margin: `0 ${theme.spacing(0.5)}`,
      color: theme.colors.primary.text,
    }),
    debugTitle: css({
      padding: `${theme.spacing(1)} ${theme.spacing(0.25)}`,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      flexGrow: 0,
      flexShrink: 1,
    }),
    debug: css({
      marginTop: theme.spacing(1),
      padding: `0 ${theme.spacing(1, 1, 1)}`,
      border: `1px solid ${theme.colors.border.weak}`,
      background: `${theme.isLight ? theme.v1.palette.white : theme.v1.palette.gray05}`,
      borderRadius: theme.shape.radius.default,
      width: '100%',
      minHeight: '300px',
      display: 'flex',
      flexDirection: 'column',
      alignSelf: 'stretch',
    }),
    debugJson: css({
      flexGrow: 1,
      height: '100%',
      overflow: 'hidden',
      padding: theme.spacing(0.5),
    }),
  };
};
