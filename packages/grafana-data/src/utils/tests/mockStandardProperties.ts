import { identityOverrideProcessor } from '../../field';
import { ThresholdsMode } from '../../types';

export const mockStandardProperties = () => {
  const title = {
    id: 'displayName',
    path: 'displayName',
    name: 'Display name',
    description: "Field's display name",
    editor: () => null,
    override: () => null,
    process: identityOverrideProcessor,
    settings: {
      placeholder: 'none',
      expandTemplateVars: true,
    },
    shouldApply: () => true,
  };

  const unit = {
    id: 'unit',
    path: 'unit',
    name: 'Unit',
    description: 'Value units',

    editor: () => null,
    override: () => null,
    process: identityOverrideProcessor,

    settings: {
      placeholder: 'none',
    },

    shouldApply: () => true,
  };

  const min = {
    id: 'min',
    path: 'min',
    name: 'Min',
    description: 'Minimum expected value',

    editor: () => null,
    override: () => null,
    process: identityOverrideProcessor,

    settings: {
      placeholder: 'auto',
    },
    shouldApply: () => true,
  };

  const max = {
    id: 'max',
    path: 'max',
    name: 'Max',
    description: 'Maximum expected value',

    editor: () => null,
    override: () => null,
    process: identityOverrideProcessor,

    settings: {
      placeholder: 'auto',
    },

    shouldApply: () => true,
  };

  const decimals = {
    id: 'decimals',
    path: 'decimals',
    name: 'Decimals',
    description: 'Number of decimal to be shown for a value',

    editor: () => null,
    override: () => null,
    process: identityOverrideProcessor,

    settings: {
      placeholder: 'auto',
      min: 0,
      max: 15,
      integer: true,
    },

    shouldApply: () => true,
  };

  const thresholds = {
    id: 'thresholds',
    path: 'thresholds',
    name: 'Thresholds',
    description: 'Manage thresholds',

    editor: () => null,
    override: () => null,
    process: identityOverrideProcessor,
    settings: {},
    defaultValue: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 80, color: 'red' },
      ],
    },
    shouldApply: () => true,
  };

  const mappings = {
    id: 'mappings',
    path: 'mappings',
    name: 'Value mappings',
    description: 'Manage value mappings',

    editor: () => null,
    override: () => null,
    process: identityOverrideProcessor,
    settings: {},
    defaultValue: [],
    shouldApply: () => true,
  };

  const noValue = {
    id: 'noValue',
    path: 'noValue',
    name: 'No Value',
    description: 'What to show when there is no value',

    editor: () => null,
    override: () => null,
    process: identityOverrideProcessor,

    settings: {
      placeholder: '-',
    },
    // ??? any optionsUi with no value
    shouldApply: () => true,
  };

  const links = {
    id: 'links',
    path: 'links',
    name: 'DataLinks',
    description: 'Manage date links',
    editor: () => null,
    override: () => null,
    process: identityOverrideProcessor,
    settings: {
      placeholder: '-',
    },
    shouldApply: () => true,
  };

  const color = {
    id: 'color',
    path: 'color',
    name: 'Color',
    description: 'Customise color',
    editor: () => null,
    override: () => null,
    process: identityOverrideProcessor,
    settings: {
      placeholder: '-',
    },
    shouldApply: () => true,
  };

  return [unit, min, max, decimals, title, noValue, thresholds, mappings, links, color];
};
