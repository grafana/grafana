import { ExploreLogsPanelState } from '@grafana/data';
/**
 * If the active viz was table, and we have displayed fields, we want to use displayed fields
 * If the active viz was table, and we have columns, we want to migrate columns to displayed fields
 * If the active viz was table, and we have displayed fields:
 * * User might have been using both panels, in this case the displayed fields from logs will overwrite the table columns
 *
 * @param panelState
 * @param updatePanelState
 * @param newLogsTable
 */
export const getDefaultDisplayedFieldsFromExploreState = (
  panelState: ExploreLogsPanelState | undefined,
  updatePanelState: (panelState: ExploreLogsPanelState) => void,
  newLogsTable: boolean
): string[] => {
  // If there are already displayed fields set, use those.
  if (panelState?.displayedFields && panelState.displayedFields.length > 0) {
    return panelState.displayedFields;
  }

  // If the user was showing the table, and columns are defined in the URL, we need to migrate the columns to displayed fields
  if (newLogsTable && panelState?.visualisationType === 'table' && panelState?.columns) {
    const columns = Object.values(panelState.columns);
    if (columns.length > 0) {
      updatePanelState({
        ...panelState,
        columns: [],
        displayedFields: columns,
      });
      return columns;
    }
  }

  return [];
};
