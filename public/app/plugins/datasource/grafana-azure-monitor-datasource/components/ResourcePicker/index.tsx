import React, { useCallback, useMemo, useReducer, useState } from 'react';
import NestedResourceTable from './NestedResourceTable';
import { Row, EntryType } from './types';
import immer from 'immer';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface ResourcePickerProps {}

const INITIAL: Row[] = [
  {
    name: 'raintank-dev',
    id: '1',
    typeLabel: 'Subscription',
    type: EntryType.Collection,
    hasChildren: true,
    isOpen: true,
    children: [
      { name: 'awoods-test', id: '2', type: EntryType.SubCollection, typeLabel: 'Resource Group', hasChildren: true },
      {
        name: 'azuremarketplacegrafana',
        id: '3',
        type: EntryType.SubCollection,
        typeLabel: 'Resource Group',
        hasChildren: true,
      },
      { name: 'azure-stack', id: '4', type: EntryType.SubCollection, typeLabel: 'Resource Group', hasChildren: true },
      {
        name: 'cloud-datasources',
        id: '5',
        type: EntryType.SubCollection,
        typeLabel: 'Resource Group',
        hasChildren: true,
        isOpen: true,
        children: [
          {
            name: 'AppInsightsTestData',
            id: '6',
            type: EntryType.Resource,
            typeLabel: 'Application Insights',
            location: 'North Europe',
            isSelectable: true,
          },
          {
            name: 'AppInsightsTestDataWorkspace',
            id: '7',
            type: EntryType.Resource,
            typeLabel: 'Log Analytics Workspace',
            location: 'North Europe',
            isSelectable: true,
          },
          {
            name: 'GitHubTestDataVM',
            id: '8',
            type: EntryType.Resource,
            typeLabel: 'Virtual Machine',
            location: 'North Europe',
            isSelectable: true,
          },
        ],
      },
      {
        name: 'grafana-test',
        id: '9',
        type: EntryType.SubCollection,
        typeLabel: 'Resource Group',
        hasChildren: true,
      },
    ],
  },
];

interface ToggleCollapseAction {
  type: 'toggle row collapse';
  row: Row;
}

type Action = ToggleCollapseAction;

function findRow(rows: Row[], targetId: string): Row | undefined {
  for (const row of rows) {
    const found = row.id === targetId;

    if (!found && row.children) {
      const foundChild = findRow(row.children, targetId);

      if (foundChild) {
        return foundChild;
      }
    }

    if (found) {
      return row;
    }
  }

  return undefined;
}

function reducer(state: Row[], action: Action): Row[] {
  return immer(state, (draftState) => {
    switch (action.type) {
      case 'toggle row collapse': {
        const foundRow = findRow(draftState, action.row.id);
        if (foundRow) {
          foundRow.isOpen = !foundRow.isOpen;
        }

        return draftState;
      }

      default:
        return draftState;
    }
  });
}

const ResourcePicker = (props: ResourcePickerProps) => {
  const styles = useStyles2(getStyles);
  const [rows, dispatch] = useReducer(reducer, INITIAL);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedRows = useMemo(() => selectedIds.map((id) => findRow(rows, id)), [rows, selectedIds]);

  // TODO: should this be entirely encapsulated within the table component?
  const handleRowToggleCollapse = useCallback(
    (row: Row) => {
      dispatch({ type: 'toggle row collapse', row: row });
      // makeApiCall()
    },
    [dispatch]
  );

  const handleRowSelectedChange = useCallback((row: Row, isSelected: boolean) => {
    setSelectedIds(isSelected ? [row.id] : []);
  }, []);

  return (
    <div>
      <NestedResourceTable
        rows={rows}
        onRowToggleCollapse={handleRowToggleCollapse}
        onRowSelectedChange={handleRowSelectedChange}
        selected={selectedIds}
      />

      {selectedIds.length > 0 && (
        <div className={styles.selectionFooter}>
          <h5>Selection</h5>
          <NestedResourceTable
            noHeader={true}
            rows={selectedRows as Row[]}
            onRowToggleCollapse={handleRowToggleCollapse}
            onRowSelectedChange={handleRowSelectedChange}
            selected={selectedIds}
          />
        </div>
      )}
    </div>
  );
};

export default ResourcePicker;

const getStyles = (theme: GrafanaTheme2) => ({
  selectionFooter: css({
    position: 'sticky',
    bottom: 0,
    background: theme.colors.background.primary,
    paddingTop: theme.spacing(2),
  }),
});
