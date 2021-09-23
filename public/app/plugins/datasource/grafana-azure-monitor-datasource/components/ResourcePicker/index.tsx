import React, { useCallback, useEffect, useMemo, useState } from 'react';
import NestedResourceTable from './NestedResourceTable';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from './types';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import ResourcePickerData from '../../resourcePicker/resourcePickerData';
import { Space } from '../Space';
import { addResources, findRow } from './utils';
import { createResourceURI, parseResourceURI } from '../../utils/resourceURIUtils';
import Datasource from '../../datasource';

interface ResourcePickerProps {
  resourcePickerData: ResourcePickerData;
  resourceURI: string | undefined;
  templateVariables: string[];

  /** Disable the selection of Subscriptions and Resource Groups */
  onlyResources?: boolean;

  datasource: Datasource;

  onApply: (resourceURI: string | undefined) => void;
  onCancel: () => void;
}

const ResourcePicker = ({
  resourcePickerData,
  resourceURI,
  templateVariables,
  onlyResources,
  datasource,
  onApply,
  onCancel,
}: ResourcePickerProps) => {
  const styles = useStyles2(getStyles);

  const [azureRows, setAzureRows] = useState<ResourceRowGroup>([]);
  const [internalSelected, setInternalSelected] = useState<string | undefined>(resourceURI);
  const [isLoading, setIsLoading] = useState(false);

  // Sync the resourceURI prop to internal state
  useEffect(() => {
    setInternalSelected(resourceURI);
  }, [resourceURI]);

  const rows = useMemo(() => {
    const templateVariableRow = resourcePickerData.transformVariablesToRow(templateVariables);
    let workingRows = templateVariables.length ? [...azureRows, templateVariableRow] : azureRows;

    if (internalSelected) {
      const parsedURI = parseResourceURI(internalSelected);
      const resourceGroupURI = `/subscriptions/${parsedURI?.subscriptionID}/resourceGroups/${parsedURI?.resourceGroup}`;
      const resourceGroupRow = findRow(workingRows, resourceGroupURI);

      console.log({ parsedURI, resourceGroupURI, resourceGroupRow });

      if (!resourceGroupRow && parsedURI) {
        let workingRows = azureRows;
        console.group('resource uri might contain template variables');

        if (datasource.isTemplateVariable(parsedURI.subscriptionID)) {
          console.group('subscription ID is a template variable');
          const variableURI = `/subscriptions/${parsedURI.subscriptionID}`;
          const interpolatedURI = datasource.replaceTemplateVariable(variableURI);

          const variableRow = findRow(workingRows, variableURI);
          const originalRow = findRow(workingRows, interpolatedURI);

          // Find a row matching the value of the variable, and copy it to a new "variable"
          // subscription
          if (originalRow && !variableRow) {
            const variableSubRow = { ...originalRow };
            variableSubRow.name = parsedURI.subscriptionID;
            variableSubRow.id = variableURI;
            // TODO: change type to variable???
            variableSubRow.children = variableSubRow.children?.map((v) => ({
              ...v,
              id: v.id.replace(interpolatedURI, variableURI),
            }));

            workingRows = [variableSubRow, ...workingRows];
          }
          console.groupEnd();
        }

        if (parsedURI.resourceGroup && datasource.isTemplateVariable(parsedURI.resourceGroup)) {
          console.group('resource group is a template variable');

          const resourceGroupURI = createResourceURI({
            subscriptionID: parsedURI.subscriptionID,
            resourceGroup: parsedURI.resourceGroup,
          });
          const interpolatedResourceGroupURI = datasource.replaceTemplateVariable(resourceGroupURI);

          const existingRow = findRow(workingRows, resourceGroupURI);
          const originalRow = findRow(workingRows, interpolatedResourceGroupURI);

          console.log('resourceGroup', { existingRow, originalRow });

          // TODO: if the original row doesnt exist, maybe we want to create a new one anyway??
          if (originalRow && !existingRow) {
            const parentURI = createResourceURI({
              subscriptionID: parsedURI.subscriptionID,
            });

            const variableRow = { ...originalRow };
            variableRow.name = parsedURI.resourceGroup;
            variableRow.id = resourceGroupURI;
            // TODO: change type to variable???
            variableRow.children = variableRow.children?.map((v) => ({
              ...v,
              id: v.id.replace(interpolatedResourceGroupURI, resourceGroupURI),
            }));

            console.log('adding in resource group row', { parentURI, variableRow });
            workingRows = addResources(workingRows, parentURI, [variableRow]);
          }
          console.groupEnd();
        }

        if (parsedURI.resource && parsedURI.resourceGroup && datasource.isTemplateVariable(parsedURI.resource)) {
          console.group('resource name is a template variable');
          console.log('workingRows at this point:', workingRows);
          const variableRow = findRow(workingRows, internalSelected);
          console.log('Resource URI:', internalSelected);
          console.log('Found row for the resource:', variableRow);

          const parentURI = createResourceURI({
            subscriptionID: parsedURI.subscriptionID,
            resourceGroup: parsedURI.resourceGroup,
          });
          const parentRow = findRow(workingRows, parentURI);
          console.log("Resource's parent row (should be resource group)", { parentURI, parentRow });

          if (!variableRow && parentRow) {
            const variableRow = {
              name: parsedURI.resource,
              id: internalSelected,
              // TODO: change type to variable???
              type: ResourceRowType.Resource,
              typeLabel: 'Resource',
            };

            console.log('adding in resource row', { parentURI, variableRow });

            workingRows = addResources(workingRows, parentURI, [variableRow]);
          }
          console.groupEnd();
        }

        if (workingRows !== azureRows) {
          console.log('Rows changed, setting state', workingRows);
          setAzureRows(workingRows);
        }

        console.groupEnd();
      }
    }

    return workingRows;
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
      const resources = await resourcePickerData.getResourcesForResourceGroup(
        datasource.replaceTemplateVariable(resourceGroup.id)
      );
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
    setIsLoading(true);
    resourcePickerData.getResourcePickerData().then((initalRows) => {
      setIsLoading(false);
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
    console.log('foundResourceRow', { foundResourceRow, internalSelected });

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
      {isLoading ? (
        <div className={styles.loadingWrapper}>
          <LoadingPlaceholder text={'Loading resources...'} />
        </div>
      ) : (
        <>
          <NestedResourceTable
            rows={rows}
            requestNestedRows={requestNestedRows}
            onRowSelectedChange={handleSelectionChanged}
            selectedRows={selectedResourceRows}
            onlyResources={!!onlyResources}
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
                  onlyResources={!!onlyResources}
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
        </>
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
  loadingWrapper: css({
    textAlign: 'center',
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    color: theme.colors.text.secondary,
  }),
});
