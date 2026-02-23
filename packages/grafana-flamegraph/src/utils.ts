import { ChatContextItem } from '@grafana/assistant';
import { DataFrame } from '@grafana/data';

export function getAssistantContextFromDataFrame(data: DataFrame): ChatContextItem[] {
  return data.meta?.custom?.assistantContext || [];
}
