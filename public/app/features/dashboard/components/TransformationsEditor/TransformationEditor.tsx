import React, { useEffect, useMemo, useState } from 'react';
import { mergeMap } from 'rxjs/operators';
import { css } from 'emotion';
import { Icon, JSONFormatter, useStyles } from '@grafana/ui';
import {
  DataFrame,
  DataTransformerConfig,
  GrafanaTheme,
  transformDataFrame,
  TransformerRegistyItem,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { TransformationsEditorTransformation } from './types';

interface TransformationEditorProps {
  debugMode?: boolean;
  index: number;
  data: DataFrame[];
  uiConfig: TransformerRegistyItem<any>;
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
  const styles = useStyles(getStyles);
  const [input, setInput] = useState<DataFrame[]>([]);
  const [output, setOutput] = useState<DataFrame[]>([]);
  const config = useMemo(() => configs[index], [configs, index]);

  useEffect(() => {
    const inputTransforms = configs.slice(0, index).map(t => t.transformation);
    const outputTransforms = configs.slice(index, index + 1).map(t => t.transformation);
    const inputSubscription = transformDataFrame(inputTransforms, data).subscribe(setInput);
    const outputSubscription = transformDataFrame(inputTransforms, data)
      .pipe(mergeMap(before => transformDataFrame(outputTransforms, before)))
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
        onChange: (opts: any) => {
          onChange(index, { id: config.transformation.id, options: opts });
        },
      }),
    [
      uiConfig.editor,
      uiConfig.transformation.defaultOptions,
      config.transformation.id,
      config.transformation.options,
      input,
      onChange,
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

const getStyles = (theme: GrafanaTheme) => {
  const debugBorder = theme.isLight ? theme.palette.gray85 : theme.palette.gray15;

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
      font-weight: ${theme.typography.weight.semibold};
      color: ${theme.colors.textBlue};
    `,
    iconRow: css`
      display: flex;
    `,
    icon: css`
      background: transparent;
      border: none;
      box-shadow: none;
      cursor: pointer;
      color: ${theme.colors.textWeak};
      margin-left: ${theme.spacing.sm};
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
      margin: 0 ${theme.spacing.xs};
      color: ${theme.colors.textBlue};
    `,
    debugTitle: css`
      padding: ${theme.spacing.sm} ${theme.spacing.xxs};
      font-family: ${theme.typography.fontFamily.monospace};
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.text};
      border-bottom: 1px solid ${debugBorder};
      flex-grow: 0;
      flex-shrink: 1;
    `,

    debug: css`
      margin-top: ${theme.spacing.sm};
      padding: 0 ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.sm};
      border: 1px solid ${debugBorder};
      background: ${theme.isLight ? theme.palette.white : theme.palette.gray05};
      border-radius: ${theme.border.radius.sm};
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
      padding: ${theme.spacing.xs};
    `,
  };
};
