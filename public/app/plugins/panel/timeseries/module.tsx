import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { commonOptionsBuilder } from '@grafana/ui';
import { optsWithHideZeros } from '@grafana/ui/internal';
import { addAnnotationOptions } from 'app/features/panel/options/builder/annotations';

import { TimeSeriesPanel } from './TimeSeriesPanel';
import { TimezonesEditor } from './TimezonesEditor';
import { defaultGraphConfig, getGraphFieldConfig } from './config';
import { graphPanelChangedHandler } from './migrations';
import { type FieldConfig, type Options } from './panelcfg.gen';
import { timeseriesPresetsSupplier } from './presets';
import { timeseriesSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options, FieldConfig>(TimeSeriesPanel)
  .setPanelChangeHandler(graphPanelChangedHandler)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder) => {
    commonOptionsBuilder.addTooltipOptions(builder, false, true, optsWithHideZeros);
    commonOptionsBuilder.addLegendOptions(builder, true, true);

    const legendCategory = [t('timeseries.legend.category', 'Legend')];

    builder.addBooleanSwitch({
      path: 'legend.enableFacetedFilter',
      name: t('timeseries.legend.name-faceted-filter', 'Series visibility'),
      category: legendCategory,
      description: t(
        'timeseries.legend.description-faceted-filter',
        'Enable filter to display series based on labels or names'
      ),
      showIf: (c) => c.legend.showLegend,
    });

    builder.addCustomEditor({
      id: 'timezone',
      name: t('timeseries.name-time-zone', 'Time zone'),
      path: 'timezone',
      category: [t('timeseries.category-axis', 'Axis')],
      editor: TimezonesEditor,
      defaultValue: undefined,
    });

    addAnnotationOptions(builder);

    const storyCategory = [t('timeseries.story.category', 'Story')];

    builder
      .addTextInput({
        path: 'story.highlight',
        name: t('timeseries.story.name-highlight', 'Highlight series'),
        description: t(
          'timeseries.story.description-highlight',
          'Series whose display name matches are drawn in the accent colour and the rest recede. Use an exact name, part of a name, or /regex/.'
        ),
        category: storyCategory,
        settings: {
          placeholder: t('timeseries.story.placeholder-highlight', 'Series name or /regex/'),
        },
      })
      .addBooleanSwitch({
        path: 'story.directLabels',
        name: t('timeseries.story.name-direct-labels', 'Direct labels'),
        description: t(
          'timeseries.story.description-direct-labels',
          'Label each series with its name and last value at the end of its line. Usually paired with a hidden legend.'
        ),
        category: storyCategory,
      })
      .addBooleanSwitch({
        path: 'story.annotationLabels',
        name: t('timeseries.story.name-annotation-labels', 'Annotation labels'),
        description: t(
          'timeseries.story.description-annotation-labels',
          'Show the text of each annotation above the plot, with a leader line to its time'
        ),
        category: storyCategory,
      });
  })
  .setSuggestionsSupplier(timeseriesSuggestionsSupplier)
  .setPresetsSupplier(timeseriesPresetsSupplier)
  .setViewPanelOptions({
    fanout: { enabled: true },
    quickToggles: {
      optionProperties: ['legend.showLegend', 'legend.placement'],
      fieldConfigProperties: ['custom.stacking', 'custom.scaleDistribution'],
    },
  })
  .setDataSupport({ annotations: true, alertStates: true });
