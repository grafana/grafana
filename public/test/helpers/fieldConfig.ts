import { identityOverrideProcessor, ThresholdsMode } from '@grafana/data';

export function mockStandardFieldConfigOptions() {
  const unit = {
    id: 'unit',
    path: 'unit',
    name: 'Unit',
    description: 'Value units',
    // @ts-ignore
    editor: () => null,
    // @ts-ignore
    override: () => null,
    process: identityOverrideProcessor,
    shouldApply: () => true,
  };

  const decimals = {
    id: 'decimals',
    path: 'decimals',
    name: 'Decimals',
    description: 'Number of decimal to be shown for a value',
    // @ts-ignore
    editor: () => null,
    // @ts-ignore
    override: () => null,
    process: identityOverrideProcessor,
    shouldApply: () => true,
  };

  const boolean = {
    id: 'boolean',
    path: 'boolean',
    name: 'Boolean',
    description: '',
    // @ts-ignore
    editor: () => null,
    // @ts-ignore
    override: () => null,
    process: identityOverrideProcessor,
    shouldApply: () => true,
  };

  const fieldColor = {
    id: 'color',
    path: 'color',
    name: 'color',
    description: '',
    // @ts-ignore
    editor: () => null,
    // @ts-ignore
    override: () => null,
    process: identityOverrideProcessor,
    shouldApply: () => true,
  };

  const text = {
    id: 'text',
    path: 'text',
    name: 'text',
    description: '',
    // @ts-ignore
    editor: () => null,
    // @ts-ignore
    override: () => null,
    process: identityOverrideProcessor,
    shouldApply: () => true,
  };

  const number = {
    id: 'number',
    path: 'number',
    name: 'number',
    description: '',
    // @ts-ignore
    editor: () => null,
    // @ts-ignore
    override: () => null,
    process: identityOverrideProcessor,
    shouldApply: () => true,
  };

  const thresholds = {
    id: 'thresholds',
    path: 'thresholds',
    name: 'thresholds',
    description: '',
    // @ts-ignore
    editor: () => null,
    // @ts-ignore
    override: () => null,
    process: identityOverrideProcessor,
    shouldApply: () => true,
    defaultValue: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 80, color: 'red' },
      ],
    },
  };

  return [unit, decimals, boolean, fieldColor, text, number, thresholds];
}
