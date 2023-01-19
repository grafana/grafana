import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { mergeMap } from 'rxjs/operators';

import {
  DataFrame,
  DataTransformerConfig,
  GrafanaTheme2,
  transformDataFrame,
  TransformerRegistryItem,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, JSONFormatter, useStyles2 } from '@grafana/ui';

import { TransformationsEditorTransformation } from './types';

interface TransformationEditorProps {
  debugMode?: boolean;
  index: number;
  data: DataFrame[];
  uiConfig: TransformerRegistryItem<any>;
  configs: TransformationsEditorTransformation[];
  onChange: (index: number, config: DataTransformerConfig) => void;
}

export const TransformationEditor = ({
  debugMode,
  index,
  data,
  uiConfig,
  configs,
  onChange,
}: TransformationEditorProps) => {
  const styles = useStyles2(getStyles);
  const [input, setInput] = useState<DataFrame[]>([]);
  const [output, setOutput] = useState<DataFrame[]>([]);
  const config = useMemo(() => configs[index], [configs, index]);

  useEffect(() => {
    const inputTransforms = configs.slice(0, index).map((t) => t.transformation);
    const outputTransforms = configs.slice(index, index + 1).map((t) => t.transformation);
    const inputSubscription = transformDataFrame(inputTransforms, data).subscribe(setInput);
    const outputSubscription = transformDataFrame(inputTransforms, data)
      .pipe(mergeMap((before) => transformDataFrame(outputTransforms, before)))
      .subscribe(setOutput);

    return function unsubscribe() {
      inputSubscription.unsubscribe();
      outputSubscription.unsubscribe();
    };
  }, [index, data, configs]);

  const editor = useMemo(
    () =>
      React.createElement(uiConfig.editor, {
        options: { ...uiConfig.transformation.defaultOptions, ...config.transformation.options },
        input,
        onChange: (opts) => {
          onChange(index, { id: config.transformation.id, options: opts });
        },
      }),
    [
      uiConfig.editor,
      uiConfig.transformation.defaultOptions,
      config.transformation.options,
      config.transformation.id,
      input,
      onChange,
      index,
    ]
  );

  return (
    <div className={styles.editor} aria-label={selectors.components.TransformTab.transformationEditor(uiConfig.name)}>
      {editor}
      {debugMode && (
        <div
          className={styles.debugWrapper}
          aria-label={selectors.components.TransformTab.transformationEditorDebugger(uiConfig.name)}
        >
          <div className={styles.debug}>
            <div className={styles.debugTitle}>Transformation input data</div>
            <div className={styles.debugJson}>
              <JSONFormatter json={input} />
            </div>
          </div>
          <div className={styles.debugSeparator}>
            <Icon name="arrow-right" />
          </div>
          <div className={styles.debug}>
            <div className={styles.debugTitle}>Transformation output data</div>
            <div className={styles.debugJson}>{output && <JSONFormatter json={output} />}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const debugBorder = theme.isLight ? theme.v1.palette.gray85 : theme.v1.palette.gray15;

  return {
    title: css`
      display: flex;
      padding: 4px 8px 4px 8px;
      position: relative;
      height: 35px;
      border-radius: 4px 4px 0 0;
      flex-wrap: nowrap;
      justify-content: space-between;
      align-items: center;
    `,
    name: css`
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.primary.text};
    `,
    iconRow: css`
      display: flex;
    `,
    icon: css`
      background: transparent;
      border: none;
      box-shadow: none;
      cursor: pointer;
      color: ${theme.colors.text.secondary};
      margin-left: ${theme.spacing(1)};
      &:hover {
        color: ${theme.colors.text};
      }
    `,
    editor: css``,
    debugWrapper: css`
      display: flex;
      flex-direction: row;
    `,
    debugSeparator: css`
      width: 48px;
      min-height: 300px;
      display: flex;
      align-items: center;
      align-self: stretch;
      justify-content: center;
      margin: 0 ${theme.spacing(0.5)};
      color: ${theme.colors.primary.text};
    `,
    debugTitle: css`
      padding: ${theme.spacing(1)} ${theme.spacing(0.25)};
      font-family: ${theme.typography.fontFamilyMonospace};
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text};
      border-bottom: 1px solid ${debugBorder};
      flex-grow: 0;
      flex-shrink: 1;
    `,

    debug: css`
      margin-top: ${theme.spacing(1)};
      padding: 0 ${theme.spacing(1, 1, 1)};
      border: 1px solid ${debugBorder};
      background: ${theme.isLight ? theme.v1.palette.white : theme.v1.palette.gray05};
      border-radius: ${theme.shape.borderRadius(1)};
      width: 100%;
      min-height: 300px;
      display: flex;
      flex-direction: column;
      align-self: stretch;
    `,
    debugJson: css`
      flex-grow: 1;
      height: 100%;
      overflow: hidden;
      padding: ${theme.spacing(0.5)};
    `,
  };
};
