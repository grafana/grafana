import { createContext } from '@grafana/assistant';
import { DataFrame } from '@grafana/data';

export function getAssistantContextFromDataFrame(data: DataFrame): Array<ReturnType<typeof createContext>> {
  return data.meta?.custom?.assistantContext || [];
}
