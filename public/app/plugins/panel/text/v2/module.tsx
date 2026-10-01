import { type DataFrame, FieldConfigProperty, PanelPlugin, type PanelOptionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';

import {
  defaultCodeOptions,
  defaultInsightOptions,
  defaultOptions,
  type Options,
  RenderMode,
  TextMode,
} from '../panelcfg.gen';

import { TextNGPanel } from './TextNGPanel';
import {
  InsightBreakdownEditor,
  InsightFollowUpsEditor,
  InsightQuestionEditor,
  InsightSourcesEditor,
} from './insight/lazy';
import { hasRenderableData, MAX_RENDERED_ROWS } from './renderContent';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';
import { isTextNewFeaturesEnabled } from './utils';

const showForData = (_options: Options, data?: DataFrame[]) => isTextNewFeaturesEnabled() && hasRenderableData(data);

const showForInsight = (options: Options) => options.mode === TextMode.Insight;

export const textNGPanelOptions: PanelOptionsSupplier<Options> = (builder) => {
  const category = [t('textng.category-text', 'Text')];
  const dataCategory = [t('textng.category-data', 'Data')];
  const insightCategory = [t('textng.category-insight', 'Insight')];

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
    path: 'pageSize',
    name: t('textng.options.page-size', 'Page size'),
    description: t(
      'textng.options.page-size-description',
      'Number of rows per page. When empty, the page size is based on the panel height.'
    ),
    category: dataCategory,
    settings: {
      placeholder: t('textng.options.page-size-placeholder', 'auto'),
      min: 1,
      max: MAX_RENDERED_ROWS,
      integer: true,
    },
    showIf: (options, data) => showForData(options, data) && options.renderMode === RenderMode.PerRow,
  });

  // Insight mode has no text to write, so unlike the other modes its inputs live here
  // rather than in the panel's own editor.
  builder
    .addCustomEditor({
      id: 'insight.question',
      path: 'insight.question',
      name: t('textng.insight.question-label', 'Question'),
      description: t(
        'textng.insight.question-description',
        'What Assistant answers using only the data the source panels show.'
      ),
      category: insightCategory,
      defaultValue: defaultInsightOptions.question,
      editor: InsightQuestionEditor,
      showIf: showForInsight,
    })
    .addCustomEditor({
      id: 'insight.sourcePanelKeys',
      path: 'insight.sourcePanelKeys',
      name: t('textng.insight.sources-label', 'Source panels'),
      description: t(
        'textng.insight.sources-description',
        'Assistant answers using only the data these panels show. Selecting a tab or row includes every panel in it.'
      ),
      category: insightCategory,
      defaultValue: defaultInsightOptions.sourcePanelKeys,
      editor: InsightSourcesEditor,
      showIf: showForInsight,
    })
    .addCustomEditor({
      id: 'insight.followUps',
      path: 'insight.followUps',
      name: t('textng.insight.follow-ups-editor-label', 'Follow-up questions'),
      description: t(
        'textng.insight.follow-ups-description',
        'Offered after the answer. Each one is answered inside the panel against the same data.'
      ),
      category: insightCategory,
      defaultValue: defaultInsightOptions.followUps,
      editor: InsightFollowUpsEditor,
      showIf: showForInsight,
    })
    .addBooleanSwitch({
      path: 'insight.compareWithPreviousPeriod',
      name: t('textng.insight.compare-label', 'Compare with previous period'),
      description: t(
        'textng.insight.compare-description',
        'Also captures the source panels over the period just before the time range, so the answer can say what changed. Runs extra queries when asking.'
      ),
      category: insightCategory,
      showIf: showForInsight,
    })
    .addCustomEditor({
      id: 'insight.breakdownVariable',
      path: 'insight.breakdownVariable',
      name: t('textng.insight.breakdown-label', 'Break down by'),
      description: t(
        'textng.insight.breakdown-description',
        'Optional. Captures the source panels that use this variable once per selected value, so the answer can compare them. Runs extra queries when asking.'
      ),
      category: insightCategory,
      editor: InsightBreakdownEditor,
      showIf: showForInsight,
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

if (isTextNewFeaturesEnabled()) {
  plugin.useFieldConfig({
    disableStandardOptions: Object.values(FieldConfigProperty).filter((id) => !SUPPORTED_FIELD_CONFIGS.has(id)),
  });
}
