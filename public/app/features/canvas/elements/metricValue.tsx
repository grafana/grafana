import { css } from '@emotion/css';
import { useCallback } from 'react';
import { useObservable } from 'react-use';
import { of } from 'rxjs';

import {
  DataFrame,
  FieldNamePickerConfigSettings,
  GrafanaTheme2,
  OneClickMode,
  StandardEditorsRegistryItem,
} from '@grafana/data';
import { TextDimensionMode } from '@grafana/schema';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { frameHasName, getFrameFieldsDisplayNames } from '@grafana/ui/src/components/MatchersUI/utils';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';

import {
  CanvasElementItem,
  CanvasElementOptions,
  CanvasElementProps,
  defaultBgColor,
  defaultTextColor,
} from '../element';
import { ElementState } from '../runtime/element';
import { Align, TextConfig, TextData, VAlign } from '../types';

// eslint-disable-next-line
const dummyFieldSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {},
} as StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings>;

const MetricValueDisplay = (props: CanvasElementProps<TextConfig, TextData>) => {
  const { data, isSelected, config } = props;
  const styles = useStyles2(getStyles(data));

  const context = usePanelContext();
  const scene = context.instanceState?.scene;
  let panelData: DataFrame[];
  panelData = context.instanceState?.scene?.data.series;

  const isEditMode = useObservable<boolean>(scene?.editModeEnabled ?? of(false));

  const getDisplayValue = () => {
    if (panelData && config.text?.field && fieldNotFound()) {
      return 'Field not found';
    }

    if (panelData && config.text?.field && !data?.text) {
      return 'No data';
    }

    return data?.text ? data.text : 'Double click to set field';
  };

  const fieldNotFound = () => {
    const fieldNames = getFrameFieldsDisplayNames(panelData);
    return !frameHasName(config.text?.field, fieldNames);
  };

  if (isEditMode && isSelected) {
    return <MetricValueEdit {...props} />;
  }

  return (
    <div className={styles.container}>
      <span className={styles.span}>{getDisplayValue()}</span>
    </div>
  );
};

const MetricValueEdit = (props: CanvasElementProps<TextConfig, TextData>) => {
  let { data, config } = props;
  const context = usePanelContext();
  let panelData: DataFrame[];
  panelData = context.instanceState?.scene?.data.series;

  const onFieldChange = useCallback(
    (field: string | undefined) => {
      let selectedElement: ElementState;
      selectedElement = context.instanceState?.selected[0];
      if (selectedElement) {
        const options = selectedElement.options;
        selectedElement.onChange({
          ...options,
          config: {
            ...options.config,
            text: { fixed: '', field: field, mode: TextDimensionMode.Field },
          },
          background: {
            color: { field: field, fixed: options.background?.color?.fixed ?? '' },
          },
        });

        // Force a re-render (update scene data after config update)
        const scene = context.instanceState?.scene;
        if (scene) {
          scene.editModeEnabled.next(false);
          scene.updateData(scene.data);
        }
      }
    },
    [context.instanceState?.scene, context.instanceState?.selected]
  );

  const styles = useStyles2(getStyles(data));
  return (
    <div className={styles.inlineEditorContainer}>
      {panelData && (
        <FieldNamePicker
          context={{ data: panelData }}
          value={config.text?.field ?? ''}
          onChange={onFieldChange}
          item={dummyFieldSettings}
        />
      )}
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

export const metricValueItem: CanvasElementItem<TextConfig, TextData> = {
  id: 'metric-value',
  name: 'Metric Value',
  description: 'Display a field value',

  display: MetricValueDisplay,

  hasEditMode: true,

  defaultSize: {
    width: 260,
    height: 50,
  },

  getNewOptions: (options) => ({
    ...options,
    config: {
      align: Align.Center,
      valign: VAlign.Middle,
      color: {
        fixed: defaultTextColor,
      },
      text: { mode: TextDimensionMode.Field, fixed: '', field: '' },
      size: 20,
    },
    background: {
      color: {
        fixed: defaultBgColor,
      },
    },
    placement: {
      width: options?.placement?.width,
      height: options?.placement?.height,
      top: options?.placement?.top ?? 100,
      left: options?.placement?.left ?? 100,
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
    const category = ['Metric value'];
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
