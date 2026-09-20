import {
  booleanOverrideProcessor,
  dataLinksOverrideProcessor,
  displayNameOverrideProcessor,
  FieldType,
  identityOverrideProcessor,
  numberOverrideProcessor,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  stringOverrideProcessor,
  ThresholdsMode,
  thresholdsOverrideProcessor,
  valueMappingsOverrideProcessor,
  type FieldConfigPropertyItem,
  type StandardEditorsRegistryItem,
} from '@grafana/data';
import { actionsOverrideProcessor } from '@grafana/data/internal';

/**
 * Grafana's field-config pipeline is driven by two registries that only the app
 * initializes, and the app's providers attach React editor components whose import
 * graph reaches backendSrv, licensing and an alerting web worker.
 *
 * A FieldConfigPropertyItem fuses value semantics (id, path, defaultValue, settings,
 * process, shouldApply) with two editor components. An embed needs only the value
 * half: it renders panels, it never edits them. So we initialize both registries
 * ourselves with the real value definitions and stub editors.
 *
 * This is what makes fieldConfig.overrides and real defaults merging work in an
 * embed without pulling any editor UI into the bundle.
 */

/** Editors are never rendered in an embed, but builder chains resolve them by id at build time. */
const NO_EDITOR = () => null;

/**
 * Every id that FieldConfigEditorBuilder / PanelOptionsEditorBuilder resolve via
 * standardEditorsRegistry.get(), plus the ids the standard field configs below use.
 * Registry.get throws on a miss, so a missing id here is a hard build-time failure.
 */
const EDITOR_IDS = [
  'number',
  'slider',
  'text',
  'strings',
  'boolean',
  'select',
  'multi-select',
  'radio',
  'unit',
  'color',
  'fieldColor',
  'links',
  'actions',
  'stats-picker',
  'timezone',
  'field-name',
  'dashboard-uid',
  'mappings',
  'thresholds',
];

function embedOptionEditors(): StandardEditorsRegistryItem[] {
  return EDITOR_IDS.map((id) => ({ id, name: id, editor: NO_EDITOR }));
}

/**
 * Value-only mirror of getAllStandardFieldConfigs (public/app/core/components/OptionsUI/registry.tsx).
 * Names are the ids rather than translated strings: nothing displays them in an embed,
 * and it keeps @grafana/i18n off this path.
 */
function embedStandardFieldConfigs(): FieldConfigPropertyItem[] {
  const base = { editor: NO_EDITOR, override: NO_EDITOR, category: ['Standard options'] };

  const displayName: FieldConfigPropertyItem = {
    ...base,
    id: 'displayName',
    path: 'displayName',
    name: 'Display name',
    process: displayNameOverrideProcessor,
    settings: { placeholder: 'none', expandTemplateVars: true },
    shouldApply: () => true,
  };

  const unit: FieldConfigPropertyItem = {
    ...base,
    id: 'unit',
    path: 'unit',
    name: 'Unit',
    process: stringOverrideProcessor,
    settings: { placeholder: 'none' },
    shouldApply: () => true,
  };

  const fieldMinMax: FieldConfigPropertyItem = {
    ...base,
    id: 'fieldMinMax',
    path: 'fieldMinMax',
    name: 'Field min/max',
    process: booleanOverrideProcessor,
    shouldApply: (field) => field.type === FieldType.number,
  };

  const min: FieldConfigPropertyItem = {
    ...base,
    id: 'min',
    path: 'min',
    name: 'Min',
    process: numberOverrideProcessor,
    settings: { placeholder: 'auto' },
    shouldApply: (field) => field.type === FieldType.number,
  };

  const max: FieldConfigPropertyItem = {
    ...base,
    id: 'max',
    path: 'max',
    name: 'Max',
    process: numberOverrideProcessor,
    settings: { placeholder: 'auto' },
    shouldApply: (field) => field.type === FieldType.number,
  };

  const decimals: FieldConfigPropertyItem = {
    ...base,
    id: 'decimals',
    path: 'decimals',
    name: 'Decimals',
    process: numberOverrideProcessor,
    settings: { placeholder: 'auto', min: 0, max: 15, integer: true },
    shouldApply: (field) => field.type === FieldType.number,
  };

  const noValue: FieldConfigPropertyItem = {
    ...base,
    id: 'noValue',
    path: 'noValue',
    name: 'No value',
    process: stringOverrideProcessor,
    settings: { placeholder: '-' },
    shouldApply: () => true,
  };

  const links: FieldConfigPropertyItem = {
    ...base,
    id: 'links',
    path: 'links',
    name: 'Data links',
    process: dataLinksOverrideProcessor,
    settings: { showOneClick: false },
    shouldApply: () => true,
    category: ['Data links and actions'],
    getItemsCount: (value) => (value ? value.length : 0),
  };

  const actions: FieldConfigPropertyItem = {
    ...base,
    id: 'actions',
    path: 'actions',
    name: 'Actions',
    process: actionsOverrideProcessor,
    settings: { showOneClick: false },
    shouldApply: () => true,
    category: ['Data links and actions'],
    getItemsCount: (value) => (value ? value.length : 0),
    hideFromDefaults: true,
  };

  const color: FieldConfigPropertyItem = {
    ...base,
    id: 'color',
    path: 'color',
    name: 'Color scheme',
    process: identityOverrideProcessor,
    settings: { byValueSupport: true, preferThresholdsMode: true },
    shouldApply: () => true,
  };

  const mappings: FieldConfigPropertyItem = {
    ...base,
    id: 'mappings',
    path: 'mappings',
    name: 'Value mappings',
    process: valueMappingsOverrideProcessor,
    settings: {},
    defaultValue: [],
    shouldApply: (field) => field.type !== FieldType.time,
    category: ['Value mappings'],
    getItemsCount: (value) => (value ? value.length : 0),
  };

  const thresholds: FieldConfigPropertyItem = {
    ...base,
    id: 'thresholds',
    path: 'thresholds',
    name: 'Thresholds',
    process: thresholdsOverrideProcessor,
    settings: {},
    defaultValue: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 80, color: 'red' },
      ],
    },
    shouldApply: () => true,
    category: ['Thresholds'],
    getItemsCount: (value) => (value ? value.steps.length : 0),
  };

  const filterable: FieldConfigPropertyItem = {
    ...base,
    id: 'filterable',
    path: 'filterable',
    name: 'Filterable',
    process: booleanOverrideProcessor,
    settings: {},
    shouldApply: () => true,
    hideFromDefaults: true,
  };

  return [
    unit,
    min,
    max,
    fieldMinMax,
    decimals,
    displayName,
    color,
    noValue,
    links,
    actions,
    mappings,
    thresholds,
    filterable,
  ];
}

let initialized = false;

/**
 * Must run before any panel module or field-config registry is constructed.
 * Registry.setInit throws if called after the registry's first read.
 */
export function initEmbedRegistries() {
  if (initialized) {
    return;
  }
  initialized = true;
  standardEditorsRegistry.setInit(embedOptionEditors);
  standardFieldConfigEditorRegistry.setInit(embedStandardFieldConfigs);
}
