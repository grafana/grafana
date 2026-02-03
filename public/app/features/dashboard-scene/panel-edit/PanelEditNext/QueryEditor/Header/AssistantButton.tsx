import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { QueryActionAssistantButton } from 'app/features/query/components/QueryActionAssistantButton';

import { QueryEditorType } from '../../constants';
import { useQueryEditorUIContext } from '../QueryEditorContext';

interface AssistantButtonProps {
  queries: DataQuery[];
}

export function AssistantButton({ queries }: AssistantButtonProps) {
  const { selectedQuery, cardType, selectedQueryDsData } = useQueryEditorUIContext();

  // Only show for queries (not expressions or transformations)
  if (cardType !== QueryEditorType.Query) {
    return null;
  }

  // Require datasource settings and selected query
  if (!selectedQueryDsData?.dsSettings || !selectedQuery) {
    return null;
  }

  return (
    <QueryActionAssistantButton
      app={CoreApp.PanelEditor}
      datasourceApi={selectedQueryDsData.datasource ?? null}
      dataSourceInstanceSettings={selectedQueryDsData.dsSettings}
      queries={queries}
      query={selectedQuery}
    />
  );
}
