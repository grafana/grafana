import {
  ReactPanelPlugin,
  sharedSingleStatMigrationCheck,
  sharedSingleStatOptionsCheck,
  GroupLayoutType,
  OptionType,
  OptionUIModel,
  PanelUIModel,
  SingleStatValueEditor,
  ThresholdsEditor,
  ValueMappingsEditor,
  BooleanOption,
  IntegerOption,
  FloatOption,
} from '@grafana/ui';
// import { GaugePanelEditor } from './GaugePanelEditor';
import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';

const getGaugePanelOptionsUIModel = () => ({
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
});

export const reactPanel = new ReactPanelPlugin<GaugeOptions>(GaugePanel)
  .setDefaults(defaults)
  .setEditor(getGaugePanelOptionsUIModel())
  .setPanelChangeHandler(sharedSingleStatOptionsCheck)
  .setMigrationHandler(sharedSingleStatMigrationCheck);
