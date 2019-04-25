import { storiesOf } from '@storybook/react';
import { PanelOptionsUIBuilder } from './PanelOptionsBuilder';
import React from 'react';
import { SingleStatValueEditor, SingleStatBaseOptions } from '../SingleStatShared/shared';
import { IntegerOption } from './NumericInputOption';
import { UseState } from '../../utils/storybook/UseState';
import { ThresholdsEditor } from '../ThresholdsEditor/ThresholdsEditor';
import { StatID } from '../../utils/statsCalculator';
import {
  OptionType,
  ObjectOptionDataSchema,
  OptionsDataSchema,
  OptionsUIModel,
  OptionsGrid,
  OptionsUIType,
  OptionsPanelGroup,
  OptionEditor,
} from '../../types/panelOptions';
import { action } from '@storybook/addon-actions';
import { PanelOptionsGroup } from '../PanelOptionsGroup/PanelOptionsGroup';

const story = storiesOf('Alpha/PanelOptionsUIBuilder', module);

export interface GaugeOptions extends SingleStatBaseOptions {
  maxValue: number;
  minValue: number;
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
}

const defaultOptions: GaugeOptions = {
  maxValue: 10,
  minValue: 0,
  showThresholdLabels: false,
  showThresholdMarkers: false,
  valueOptions: {
    prefix: '',
    suffix: '',
    decimals: null,
    stat: StatID.mean,
    unit: 'none',
  },
  thresholds: [
    {
      index: 0,
      // @ts-ignore
      value: null,
      color: 'green',
    },
    {
      index: 1,
      value: 80,
      color: 'red',
    },
  ],
  valueMappings: [],
};

story.add('default', () => {
  return (
    <div>
      <UseState initialState={defaultOptions}>
        {(options, updateState) => {
          return (
            <PanelOptionsUIBuilder
              optionsSchema={GaugeOptionsSchema}
              uiModel={GaugeOptionsModel}
              options={options}
              onOptionsChange={(key, value) => {
                const stateUpdate: { [key: string]: any } = {};
                stateUpdate[key] = value;
                action('Options changed:')(stateUpdate);
                updateState({
                  ...options,
                  ...stateUpdate,
                });
              }}
            />
          );
        }}
      </UseState>
    </div>
  );
});

export const GaugeOptionsModel: OptionsUIModel<GaugeOptions> = {
  model: {
    type: OptionsUIType.Layout,
    config: {
      columns: 1,
    },
    content: [
      {
        type: OptionsUIType.Layout,
        config: { columns: 3 },
        content: [
          {
            type: OptionsUIType.Group,
            config: { title: 'Thresholds' },
            component: PanelOptionsGroup,
            content: [
              {
                type: OptionsUIType.Editor,
                editor: {
                  optionType: OptionType.Object,
                  component: ThresholdsEditor,
                  property: 'thresholds',
                },
              } as OptionEditor<GaugeOptions, 'thresholds'>,
            ],
          } as OptionsPanelGroup,
          {
            type: OptionsUIType.Group,
            config: { title: 'Value settings' },
            component: PanelOptionsGroup,
            content: [
              {
                type: OptionsUIType.Editor,
                editor: {
                  optionType: OptionType.Object,
                  component: SingleStatValueEditor,
                  property: 'valueOptions',
                },
              } as OptionEditor<GaugeOptions, 'valueOptions'>,
            ],
          } as OptionsPanelGroup,
          {
            type: OptionsUIType.Group,
            config: { title: 'Gauge' },
            component: PanelOptionsGroup,
            content: [
              {
                type: OptionsUIType.Editor,
                editor: {
                  optionType: OptionType.Number,
                  component: IntegerOption,
                  property: 'minValue',
                  label: 'Min value',
                },
              } as OptionEditor<GaugeOptions, 'minValue'>,
              {
                type: OptionsUIType.Editor,
                editor: {
                  optionType: OptionType.Number,
                  component: IntegerOption,
                  property: 'maxValue',
                  label: 'Max value',
                },
              } as OptionEditor<GaugeOptions, 'maxValue'>,
            ],
          } as OptionsPanelGroup,
        ],
      } as OptionsGrid,
    ],
  } as OptionsGrid,
};

const valueOptionsSchema: ObjectOptionDataSchema<SingleStatBaseOptions> = {
  properties: {
    orientation: {},
    thresholds: {},
    valueMappings: {},
    valueOptions: {},
  },
};

const GaugeOptionsSchema: OptionsDataSchema<GaugeOptions> = {
  title: 'GaugeOptions',
  type: 'object',
  required: ['minValue'],
  properties: {
    minValue: {
      type: 'number',
      description: 'Hint for min value...',
    },
    maxValue: {
      type: 'number',
      description: 'Hint for min value...',
    },
    showThresholdMarkers: {
      type: 'boolean',
    },
    showThresholdLabels: {
      type: 'boolean',
    },
    ...valueOptionsSchema.properties,
  },
};
