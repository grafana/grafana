import { type ChatContextItem } from '@grafana/assistant';
import { type DataFrame } from '@grafana/data';

export function getAssistantContextFromDataFrame(data: DataFrame): ChatContextItem[] {
  return data.meta?.custom?.assistantContext || [];
}
