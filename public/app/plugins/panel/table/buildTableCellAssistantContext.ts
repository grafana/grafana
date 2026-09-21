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
  rowIndex: number;
  replaceVariables: InterpolateFunction;
}

export function buildTableCellAssistantContext({
  frame,
  field,
  rowIndex,
  ...panelContext
}: BuildArgs): ChatContextItem[] {
  const value = field.values[rowIndex];
  const displayValue = field.display ? formattedValueToString(field.display(value)) : String(value ?? '');
  const displayName = getFieldDisplayName(field, frame);

  return [
    createAssistantContextItem('structured', {
      title: `${displayValue} › ${displayName} › ${panelContext.panelTitle}`,
      icon: 'table',
      data: {
        kind: 'table-cell',
        cell: { value, displayValue, rowIndex },
        field: { name: field.name, displayName, type: field.type, unit: field.config.unit, labels: field.labels ?? {} },
        query: { refId: frame.refId, executedQueryString: frame.meta?.executedQueryString },
        panel: buildAssistantPanelContext(panelContext),
      },
    }),
  ];
}
