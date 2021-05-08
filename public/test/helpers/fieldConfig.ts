import { identityOverrideProcessor, ThresholdsMode } from '@grafana/data';

export function mockStandardFieldConfigOptions() {
  const category = ['Standard options'];

  const unit = {
    category,
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
    category,
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
    category,
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
    category,
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
    category,
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
    category,
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
    category: ['Thresholds'],
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
