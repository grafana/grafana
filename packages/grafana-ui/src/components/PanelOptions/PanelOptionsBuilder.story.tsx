import { storiesOf } from '@storybook/react';
import { PanelOptionsUIBuilder } from './PanelOptionsBuilder';
import React from 'react';
import { SingleStatValueEditor, SingleStatBaseOptions } from '../SingleStatShared/shared';
import { BooleanOption } from './BooleanOption';
import { FloatOption, IntegerOption } from './NumericInputOption';
import { UseState } from '../../utils/storybook/UseState';
import { ThresholdsEditor } from '../ThresholdsEditor/ThresholdsEditor';
import { StatID } from '../../utils/statsCalculator';
import { ValueMappingsEditor } from '../ValueMappingsEditor/ValueMappingsEditor';
import { OptionsUIModel, GroupLayoutType, OptionType, OptionUIModel, PanelUIModel } from '../../types/panelOptions';
import { action } from '@storybook/addon-actions';

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

const GaugeOptionsModel: OptionsUIModel<GaugeOptions> = {
  rows: [
    {
      columns: 3,
      content: [
        {
          type: GroupLayoutType.Panel,
          groupOptions: {
            title: 'Gauge',
          },
          options: [
            {
              type: OptionType.Float,
              path: 'minValue',
              component: IntegerOption,
              label: 'Min value',
              placeholder: 'Min value',
            } as OptionUIModel<GaugeOptions, 'minValue'>,
            {
              type: OptionType.Float,
              path: 'maxValue',
              component: FloatOption,
              label: 'Max value',
              placeholder: 'Max value',
            } as OptionUIModel<GaugeOptions, 'maxValue'>,
            {
              type: OptionType.Boolean,
              path: 'showThresholdLabels',
              component: BooleanOption,
              label: 'Show labels',
            } as OptionUIModel<GaugeOptions, 'showThresholdLabels'>,
            {
              type: OptionType.Boolean,
              path: 'showThresholdMarkers',
              component: BooleanOption,
              label: 'Show markers',
            } as OptionUIModel<GaugeOptions, 'showThresholdMarkers'>,
          ],
        } as PanelUIModel,
        {
          type: GroupLayoutType.Panel,
          groupOptions: {
            title: 'Value Settings',
          },
          options: [
            {
              type: OptionType.Object,
              path: 'valueOptions',
              component: SingleStatValueEditor,
            } as OptionUIModel<GaugeOptions, 'valueOptions'>,
          ],
        } as PanelUIModel,
        {
          type: GroupLayoutType.Panel,
          groupOptions: {
            title: 'Thresholds',
          },
          options: [
            {
              type: OptionType.Array,
              path: 'thresholds',
              component: ThresholdsEditor,
            } as OptionUIModel<GaugeOptions, 'thresholds'>,
          ],
        } as PanelUIModel,
      ],
    },
    {
      columns: 1,
      content: [
        {
          type: OptionType.Object,
          path: 'valueMappings',
          component: ValueMappingsEditor,
          label: 'Min value',
          placeholder: 'Min value',
        } as OptionUIModel<GaugeOptions, 'valueMappings'>,
      ],
    },
  ],
};
