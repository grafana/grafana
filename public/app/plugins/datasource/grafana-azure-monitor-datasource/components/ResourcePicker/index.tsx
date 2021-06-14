import React, { useCallback, useEffect, useMemo, useState } from 'react';
import NestedResourceTable from './NestedResourceTable';
import { ResourceRow, ResourceRowGroup } from './types';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import ResourcePickerData from '../../resourcePicker/resourcePickerData';
import { Space } from '../Space';
import { addResources, findRow, parseResourceURI } from './utils';

interface ResourcePickerProps {
  resourcePickerData: ResourcePickerData;
  resourceURI: string | undefined;
  templateVariables: string[];

  onApply: (resourceURI: string | undefined) => void;
  onCancel: () => void;
}

const ResourcePicker = ({
  resourcePickerData,
  resourceURI,
  templateVariables,
  onApply,
  onCancel,
}: ResourcePickerProps) => {
  const styles = useStyles2(getStyles);

  const [azureRows, setAzureRows] = useState<ResourceRowGroup>([]);
  const [internalSelected, setInternalSelected] = useState<string | undefined>(resourceURI);

  // Sync the resourceURI prop to internal state
  useEffect(() => {
    setInternalSelected(resourceURI);
  }, [resourceURI]);

  const rows = useMemo(() => {
    const templateVariableRow = resourcePickerData.transformVariablesToRow(templateVariables);
    return templateVariables.length ? [...azureRows, templateVariableRow] : azureRows;
  }, [resourcePickerData, azureRows, templateVariables]);

  // Map the selected item into an array of rows
  const selectedResourceRows = useMemo(() => {
    const found = internalSelected && findRow(rows, internalSelected);
    return found
      ? [
          {
            ...found,
            children: undefined,
          },
        ]
      : [];
  }, [internalSelected, rows]);

  // Request resources for a expanded resource group
  const requestNestedRows = useCallback(
    async (resourceGroup: ResourceRow) => {
      // If we already have children, we don't need to re-fetch them. Also abort if we're expanding the special
      // template variable group, though that shouldn't happen in practice
      if (resourceGroup.children?.length || resourceGroup.id === ResourcePickerData.templateVariableGroupID) {
        return;
      }

      // fetch and set nested resources for the resourcegroup into the bigger state object
      const resources = await resourcePickerData.getResourcesForResourceGroup(resourceGroup);
      const newRows = addResources(azureRows, resourceGroup.id, resources);
      setAzureRows(newRows);
    },
    [resourcePickerData, azureRows]
  );

  // Select
  const handleSelectionChanged = useCallback((row: ResourceRow, isSelected: boolean) => {
    isSelected ? setInternalSelected(row.id) : setInternalSelected(undefined);
  }, []);

  // Request initial data on first mount
  useEffect(() => {
    resourcePickerData.getResourcePickerData().then((initalRows) => {
      setAzureRows(initalRows);
    });
  }, [resourcePickerData]);

  // Request sibling resources for a selected resource - in practice should only be on first mount
  useEffect(() => {
    if (!internalSelected || !rows.length) {
      return;
    }

    // If we can find this resource in the rows, then we don't need to load anything
    const foundResourceRow = findRow(rows, internalSelected);
    if (foundResourceRow) {
      return;
    }

    const parsedURI = parseResourceURI(internalSelected);
    const resourceGroupURI = `/subscriptions/${parsedURI?.subscriptionID}/resourceGroups/${parsedURI?.resourceGroup}`;
    const resourceGroupRow = findRow(rows, resourceGroupURI);

    if (!resourceGroupRow) {
      // We haven't loaded the data from Azure yet
      return;
    }

    requestNestedRows(resourceGroupRow);
  }, [requestNestedRows, internalSelected, rows]);

  const handleApply = useCallback(() => {
    onApply(internalSelected);
  }, [internalSelected, onApply]);

  return (
    <div>
      <NestedResourceTable
        rows={rows}
        requestNestedRows={requestNestedRows}
        onRowSelectedChange={handleSelectionChanged}
        selectedRows={selectedResourceRows}
      />

      <div className={styles.selectionFooter}>
        {selectedResourceRows.length > 0 && (
          <>
            <Space v={2} />
            <h5>Selection</h5>
            <NestedResourceTable
              rows={selectedResourceRows}
              requestNestedRows={requestNestedRows}
              onRowSelectedChange={handleSelectionChanged}
              selectedRows={selectedResourceRows}
              noHeader={true}
            />
          </>
        )}

        <Space v={2} />

        <Button onClick={handleApply}>Apply</Button>
        <Space layout="inline" h={1} />
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
      </div>
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
