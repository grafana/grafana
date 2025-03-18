import { css } from '@emotion/css';
import { useCallback, useEffect, useRef } from 'react';
import * as React from 'react';
import { useObservable } from 'react-use';
import { of } from 'rxjs';

import { DataFrame, GrafanaTheme2, OneClickMode } from '@grafana/data';
import { Input, usePanelContext, useStyles2 } from '@grafana/ui';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';

import { CanvasElementItem, CanvasElementOptions, CanvasElementProps, defaultThemeTextColor } from '../element';
import { ElementState } from '../runtime/element';
import { Align, TextConfig, TextData, VAlign } from '../types';

const TextDisplay = (props: CanvasElementProps<TextConfig, TextData>) => {
  const { data, isSelected } = props;
  const styles = useStyles2(getStyles(data));

  const context = usePanelContext();
  const scene = context.instanceState?.scene;

  const isEditMode = useObservable<boolean>(scene?.editModeEnabled ?? of(false));

  if (isEditMode && isSelected) {
    return <TextEdit {...props} />;
  }
  return (
    <div className={styles.container}>
      <span className={styles.span}>{data?.text ? data.text : 'Double click to set text'}</span>
    </div>
  );
};

const TextEdit = (props: CanvasElementProps<TextConfig, TextData>) => {
  let { data, config } = props;
  const context = usePanelContext();
  let panelData: DataFrame[];
  panelData = context.instanceState?.scene?.data.series;

  const textRef = useRef<string>(config.text?.fixed ?? '');

  // Save text on TextEdit unmount
  useEffect(() => {
    return () => {
      saveText(textRef.current);
    };
  });

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const scene = context.instanceState?.scene;
      if (scene) {
        scene.editModeEnabled.next(false);
      }
    }
  };

  const onKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
    textRef.current = event.currentTarget.value;
  };

  const saveText = useCallback(
    (textValue: string) => {
      let selectedElement: ElementState;
      selectedElement = context.instanceState?.selected[0];
      if (selectedElement) {
        const options = selectedElement.options;
        selectedElement.onChange({
          ...options,
          config: {
            ...options.config,
            text: { ...selectedElement.options.config.text, fixed: textValue },
          },
        });

        // Force a re-render (update scene data after config update)
        const scene = context.instanceState?.scene;
        if (scene) {
          scene.updateData(scene.data);
        }
      }
    },
    [context.instanceState?.scene, context.instanceState?.selected]
  );

  const styles = useStyles2(getStyles(data));
  return (
    <div className={styles.inlineEditorContainer}>
      {panelData && <Input defaultValue={config.text?.fixed ?? ''} onKeyDown={onKeyDown} onKeyUp={onKeyUp} autoFocus />}
    </div>
  );
};

const getStyles = (data: TextData | undefined) => (theme: GrafanaTheme2) => ({
  container: css({
    position: 'absolute',
    height: '100%',
    width: '100%',
    display: 'table',
  }),
  inlineEditorContainer: css({
    height: '100%',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1),
  }),
  span: css({
    display: 'table-cell',
    verticalAlign: data?.valign,
    textAlign: data?.align,
    fontSize: `${data?.size}px`,
    color: data?.color,
  }),
});

export const textItem: CanvasElementItem<TextConfig, TextData> = {
  id: 'text',
  name: 'Text',
  description: 'Display text',

  display: TextDisplay,

  hasEditMode: true,

  defaultSize: {
    width: 100,
    height: 50,
  },

  getNewOptions: (options) => ({
    ...options,
    config: {
      align: Align.Center,
      valign: VAlign.Middle,
      color: {
        fixed: defaultThemeTextColor,
      },
      size: 16,
    },
    placement: {
      width: options?.placement?.width ?? 100,
      height: options?.placement?.height ?? 100,
      top: options?.placement?.top,
      left: options?.placement?.left,
      rotation: options?.placement?.rotation ?? 0,
    },
    oneClickMode: options?.oneClickMode ?? OneClickMode.Off,
    links: options?.links ?? [],
  }),

  prepareData: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<TextConfig>) => {
    const textConfig = elementOptions.config;

    const data: TextData = {
      text: textConfig?.text ? dimensionContext.getText(textConfig.text).value() : '',
      field: textConfig?.text?.field,
      align: textConfig?.align ?? Align.Center,
      valign: textConfig?.valign ?? VAlign.Middle,
      size: textConfig?.size,
    };

    if (textConfig?.color) {
      data.color = dimensionContext.getColor(textConfig.color).value();
    }

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = ['Text'];
    builder
      .addCustomEditor({
        category,
        id: 'textSelector',
        path: 'config.text',
        name: 'Text',
        editor: TextDimensionEditor,
      })
      .addCustomEditor({
        category,
        id: 'config.color',
        path: 'config.color',
        name: 'Text color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {},
      })
      .addRadio({
        category,
        path: 'config.align',
        name: 'Align text',
        settings: {
          options: [
            { value: Align.Left, label: 'Left' },
            { value: Align.Center, label: 'Center' },
            { value: Align.Right, label: 'Right' },
          ],
        },
        defaultValue: Align.Left,
      })
      .addRadio({
        category,
        path: 'config.valign',
        name: 'Vertical align',
        settings: {
          options: [
            { value: VAlign.Top, label: 'Top' },
            { value: VAlign.Middle, label: 'Middle' },
            { value: VAlign.Bottom, label: 'Bottom' },
          ],
        },
        defaultValue: VAlign.Middle,
      })
      .addNumberInput({
        category,
        path: 'config.size',
        name: 'Text size',
        settings: {
          placeholder: 'Auto',
        },
      });
  },
};
