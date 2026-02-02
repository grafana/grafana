import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { QueryActionAssistantButton } from 'app/features/query/components/QueryActionAssistantButton';

import { QueryEditorType } from '../../constants';
import { useDatasourceContext, useQueryEditorUIContext } from '../QueryEditorContext';

interface AssistantButtonProps {
  queries: DataQuery[];
}

export function AssistantButton({ queries }: AssistantButtonProps) {
  const { datasource, dsSettings } = useDatasourceContext();
  const { selectedQuery, cardType } = useQueryEditorUIContext();

  // Only show for queries (not expressions or transformations)
  if (cardType !== QueryEditorType.Query) {
    return null;
  }

  // Require datasource settings and selected query
  if (!dsSettings || !selectedQuery) {
    return null;
  }

  return (
    <QueryActionAssistantButton
      app={CoreApp.PanelEditor}
      datasourceApi={datasource ?? null}
      dataSourceInstanceSettings={dsSettings}
      queries={queries}
      query={selectedQuery}
    />
  );
}
