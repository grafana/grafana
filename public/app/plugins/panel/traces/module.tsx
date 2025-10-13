import { PanelPlugin, toOption } from '@grafana/data';

import { getTraceServiceNames, getTraceSpanNames } from '../../../features/explore/TraceView/utils/tags';
import { transformDataFrames } from '../../../features/explore/TraceView/utils/transform';

import { TagsEditor } from './TagsEditor';
import { TracesPanel } from './TracesPanel';
import { TracesSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin(TracesPanel)
  .setPanelOptions((builder, context) => {
    const category = ['Span filters'];
    const trace = transformDataFrames(context?.data?.[0]);

    // Find
    builder
      .addTextInput({
        path: 'spanFilters.query',
        name: 'Find in trace',
        category,
      })
      .addBooleanSwitch({
        path: 'spanFilters.matchesOnly',
        name: 'Show matches only',
        defaultValue: false,
        category,
      })
      .addBooleanSwitch({
        path: 'spanFilters.criticalPathOnly',
        name: 'Show critical path only',
        defaultValue: false,
        category,
      });

    // Service name
    builder
      .addSelect({
        path: 'spanFilters.serviceName',
        name: 'Service name',
        category,
        settings: {
          options: trace ? getTraceServiceNames(trace).map(toOption) : [],
          allowCustomValue: true,
          isClearable: true,
        },
      })
      .addRadio({
        path: 'spanFilters.serviceNameOperator',
        name: 'Service name operator',
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
        name: 'Span name',
        category,
        settings: {
          options: trace ? getTraceSpanNames(trace).map(toOption) : [],
          allowCustomValue: true,
          isClearable: true,
        },
      })
      .addRadio({
        path: 'spanFilters.spanNameOperator',
        name: 'Span name operator',
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
        name: 'Min duration',
        category,
      })
      .addTextInput({
        path: 'spanFilters.to',
        name: 'Max duration',
        category,
      });

    builder.addCustomEditor({
      id: 'tags',
      name: 'Tags',
      path: 'spanFilters',
      category,
      editor: TagsEditor,
      defaultValue: undefined,
    });
  })
  .setSuggestionsSupplier(new TracesSuggestionsSupplier());
