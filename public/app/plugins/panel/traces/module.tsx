import { useMemo } from 'react';

import { PanelPlugin } from '@grafana/data';

import { transformDataFrames } from '../../../features/explore/TraceView/utils/transform';

import { TagsEditor } from './TagsEditor';
import { TracesPanel } from './TracesPanel';
import { TracesSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin(TracesPanel)
  .setPanelOptions((builder, context) => {
    const category = ['Span filters'];
    console.log(context);

    const traceProp = useMemo(() => transformDataFrames(context.data[0]), [context.data]);

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
      .addTextInput({
        path: 'spanFilters.serviceName',
        name: 'Service name',
        category,
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
      .addTextInput({
        path: 'spanFilters.spanName',
        name: 'Span name',
        category,
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
      path: 'tags',
      category,
      editor: TagsEditor,
      defaultValue: undefined,
    });
  })
  .setSuggestionsSupplier(new TracesSuggestionsSupplier());
