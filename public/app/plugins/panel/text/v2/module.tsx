import { type DataFrame, FieldConfigProperty, PanelPlugin, type PanelOptionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getFeatureFlagClient } from '@grafana/runtime/internal';

import { defaultCodeOptions, defaultOptions, type Options, RenderMode } from '../panelcfg.gen';

import { TextNGPanel } from './TextNGPanel';
import { hasRenderableData, MAX_RENDERED_ROWS } from './renderContent';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';

function newFeaturesEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue('text.newFeatures', false);
}

const showForData = (_options: Options, data?: DataFrame[]) => newFeaturesEnabled() && hasRenderableData(data);

export const textNGPanelOptions: PanelOptionsSupplier<Options> = (builder) => {
  const category = [t('textng.category-text', 'Text')];
  const dataCategory = [t('textng.category-data', 'Data')];

  // Everything is edited in the panel itself, so options are registered here
  // only so their defaults are applied.
  const addHiddenOption = <T,>(path: string, defaultValue: T) =>
    builder.addCustomEditor({
      id: path,
      path,
      name: '',
      category,
      editor: () => null,
      defaultValue,
      showIf: () => false,
    });

  addHiddenOption('mode', defaultOptions.mode);
  addHiddenOption('content', defaultOptions.content);
  addHiddenOption('code.language', defaultCodeOptions.language);
  addHiddenOption('code.showLineNumbers', defaultCodeOptions.showLineNumbers);

  builder.addRadio({
    path: 'renderMode',
    name: t('textng.options.render-mode', 'Render mode'),
    category: dataCategory,
    defaultValue: defaultOptions.renderMode,
    settings: {
      options: [
        {
          value: RenderMode.Once,
          label: t('textng.render-mode.once', 'Once'),
        },
        {
          value: RenderMode.PerRow,
          label: t('textng.render-mode.per-row', 'Per row'),
        },
      ],
    },
    showIf: showForData,
  });

  builder.addNumberInput({
    path: 'maxRows',
    name: t('textng.options.max-rows', 'Row limit'),
    description: t(
      'textng.options.max-rows-description',
      'Rows of query data to render. High values can slow the panel, especially with complex HTML.'
    ),
    category: dataCategory,
    settings: { min: 1, max: MAX_RENDERED_ROWS, integer: true, placeholder: String(MAX_RENDERED_ROWS) },
    showIf: showForData,
  });
};

const SUPPORTED_FIELD_CONFIGS = new Set<FieldConfigProperty>([
  FieldConfigProperty.Mappings,
  FieldConfigProperty.Thresholds,
]);

export const plugin = new PanelPlugin<Options>(TextNGPanel)
  .setPanelOptions(textNGPanelOptions)
  .setMigrationHandler(textPanelMigrationHandler)
  .setSuggestionsSupplier(() => []);

if (newFeaturesEnabled()) {
  plugin.useFieldConfig({
    disableStandardOptions: Object.values(FieldConfigProperty).filter((id) => !SUPPORTED_FIELD_CONFIGS.has(id)),
  });
}
