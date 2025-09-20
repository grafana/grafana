import { CoreApp, DataSourceInstanceSettings } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { Stack } from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { AlertQuery } from 'app/types/unified-alerting-dto';

interface Props {
  query: AlertQuery;
  datasourceInstanceSettings: DataSourceInstanceSettings | undefined;
  onQueryReplace: (query: DataQuery) => void;
  showButtons: boolean; // Control when to show buttons
  onlyIcons?: boolean; // Force icon-only display
}

export function AlertingQueryEditorActionsWrapper({
  query,
  datasourceInstanceSettings,
  onQueryReplace,
  showButtons,
  onlyIcons,
}: Props) {
  const { renderSavedQueryButtons } = useQueryLibraryContext();

  if (!showButtons) {
    return null;
  }

  // Convert AlertQuery to DataQuery format for SavedQueryButtons
  const dataQuery: DataQuery = {
    ...query.model,
    datasource: datasourceInstanceSettings
      ? {
          type: datasourceInstanceSettings.type,
          uid: datasourceInstanceSettings.uid,
        }
      : undefined,
  };

  const savedQueryButtons = renderSavedQueryButtons(
    dataQuery,
    CoreApp.UnifiedAlerting,
    undefined,
    onQueryReplace,
    datasourceInstanceSettings?.name ? [datasourceInstanceSettings.name] : [],
    onlyIcons
  );

  return (
    savedQueryButtons && (
      <Stack direction="column" gap={1}>
        <Stack justifyContent="flex-end">{savedQueryButtons}</Stack>
      </Stack>
    )
  );
}
