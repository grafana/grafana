import { PanelPlugin, toOption } from '@grafana/data';
import { t } from '@grafana/i18n';

import { getTraceServiceNames, getTraceSpanNames } from '../../../features/explore/TraceView/utils/tags';
import { transformDataFrames } from '../../../features/explore/TraceView/utils/transform';

import { TagsEditor } from './TagsEditor';
import { TracesPanel } from './TracesPanel';
import { TracesSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin(TracesPanel)
  .setPanelOptions((builder, context) => {
    const category = [t('traces.category-span-filters', 'Span filters')];
    const trace = transformDataFrames(context?.data?.[0]);

    // Find
    builder
      .addTextInput({
        path: 'spanFilters.query',
        name: t('traces.name-find-in-trace', 'Find in trace'),
        category,
      })
      .addBooleanSwitch({
        path: 'spanFilters.matchesOnly',
        name: t('traces.name-show-matches-only', 'Show matches only'),
        defaultValue: false,
        category,
      })
      .addBooleanSwitch({
        path: 'spanFilters.criticalPathOnly',
        name: t('traces.name-critical-path-only', 'Show critical path only'),
        defaultValue: false,
        category,
      });

    // Service name
    builder
      .addSelect({
        path: 'spanFilters.serviceName',
        name: t('traces.name-service-name', 'Service name'),
        category,
        settings: {
          options: trace ? getTraceServiceNames(trace).map(toOption) : [],
          allowCustomValue: true,
          isClearable: true,
        },
      })
      .addRadio({
        path: 'spanFilters.serviceNameOperator',
        name: t('traces.name-service-name-operator', 'Service name operator'),
        defaultValue: '=',
        settings: {
          options: [
            { value: '=', label: '=' },
            { value: '!=', label: '!=' },
          ],
        },
        category,
      });

    // Span name
    builder
      .addSelect({
        path: 'spanFilters.spanName',
        name: t('traces.name-span-name', 'Span name'),
        category,
        settings: {
          options: trace ? getTraceSpanNames(trace).map(toOption) : [],
          allowCustomValue: true,
          isClearable: true,
        },
      })
      .addRadio({
        path: 'spanFilters.spanNameOperator',
        name: t('traces.name-span-name-operator', 'Span name operator'),
        defaultValue: '=',
        settings: {
          options: [
            { value: '=', label: '=' },
            { value: '!=', label: '!=' },
          ],
        },
        category,
      });

    // Duration
    builder
      .addTextInput({
        path: 'spanFilters.from',
        name: t('traces.name-min-duration', 'Min duration'),
        category,
      })
      .addTextInput({
        path: 'spanFilters.to',
        name: t('traces.name-max-duration', 'Max duration'),
        category,
      });

    builder.addCustomEditor({
      id: 'tags',
      name: t('traces.name-tags', 'Tags'),
      path: 'spanFilters',
      category,
      editor: TagsEditor,
      defaultValue: undefined,
    });
  })
  .setSuggestionsSupplier(new TracesSuggestionsSupplier());
