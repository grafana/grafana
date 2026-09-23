import { type ChatContextItem, createAssistantContextItem } from '@grafana/assistant';
import {
  type DataFrame,
  type Field,
  formattedValueToString,
  getFieldDisplayName,
  type InterpolateFunction,
} from '@grafana/data';
import { type AssistantPanelContext, buildAssistantPanelContext } from 'app/core/assistant/buildAssistantPanelContext';

interface BuildArgs extends AssistantPanelContext {
  frame: DataFrame;
  field: Field;
  replaceVariables: InterpolateFunction;
}

export function buildTableFieldAssistantContext({ frame, field, ...panelContext }: BuildArgs): ChatContextItem[] {
  const displayName = getFieldDisplayName(field, frame);

  return [
    createAssistantContextItem('structured', {
      title: `${displayName} › ${panelContext.panelTitle}`,
      icon: 'table',
      data: {
        kind: 'table-field',
        field: {
          name: field.name,
          displayName,
          type: field.type,
          unit: field.config.unit,
          labels: field.labels ?? {},
          values: [...field.values],
          displayValues: field.values.map((value) =>
            field.display ? formattedValueToString(field.display(value)) : String(value ?? '')
          ),
        },
        query: { refId: frame.refId, executedQueryString: frame.meta?.executedQueryString },
        panel: buildAssistantPanelContext(panelContext),
      },
    }),
  ];
}
