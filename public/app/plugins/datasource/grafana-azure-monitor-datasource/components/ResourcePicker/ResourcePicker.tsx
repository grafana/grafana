import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Alert, Button, Icon, Input, LoadingPlaceholder, Tooltip, useStyles2, Collapse, Label } from '@grafana/ui';

import ResourcePickerData from '../../resourcePicker/resourcePickerData';
import messageFromError from '../../utils/messageFromError';
import { Space } from '../Space';

import NestedRow from './NestedRow';
import getStyles from './styles';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from './types';
import { addResources, findRow, parseResourceURI } from './utils';

interface ResourcePickerProps {
  resourcePickerData: ResourcePickerData;
  resourceURI: string | undefined;
  selectableEntryTypes: ResourceRowType[];

  onApply: (resourceURI: string | undefined) => void;
  onCancel: () => void;
}

const ResourcePicker = ({
  resourcePickerData,
  resourceURI,
  onApply,
  onCancel,
  selectableEntryTypes,
}: ResourcePickerProps) => {
  const styles = useStyles2(getStyles);

  type LoadingStatus = 'NotStarted' | 'Started' | 'Done';
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>('NotStarted');
  const [azureRows, setAzureRows] = useState<ResourceRowGroup>([]);
  const [internalSelectedURI, setInternalSelectedURI] = useState<string | undefined>(resourceURI);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(resourceURI?.includes('$'));
  // Sync the resourceURI prop to internal state
  useEffect(() => {
    setInternalSelectedURI(resourceURI);
  }, [resourceURI]);

  // Request initial data on first mount
  useEffect(() => {
    if (loadingStatus === 'NotStarted') {
      const loadInitialData = async () => {
        try {
          setLoadingStatus('Started');
          let resources = await resourcePickerData.getSubscriptions();
          if (!internalSelectedURI) {
            setAzureRows(resources);
            setLoadingStatus('Done');
            return;
          }

          const parsedURI = parseResourceURI(internalSelectedURI ?? '');
          if (parsedURI) {
            const resourceGroupURI = `/subscriptions/${parsedURI.subscriptionID}/resourceGroups/${parsedURI.resourceGroup}`;

            // if a resource group was previously selected, but the resource groups under the parent subscription have not been loaded yet
            if (parsedURI.resourceGroup && !findRow(resources, resourceGroupURI)) {
              const resourceGroups = await resourcePickerData.getResourceGroupsBySubscriptionId(
                parsedURI.subscriptionID
              );
              resources = addResources(resources, `/subscriptions/${parsedURI.subscriptionID}`, resourceGroups);
            }

            // if a resource was previously selected, but the resources under the parent resource group have not been loaded yet
            if (parsedURI.resource && !findRow(azureRows, parsedURI.resource ?? '')) {
              const resourcesForResourceGroup = await resourcePickerData.getResourcesForResourceGroup(resourceGroupURI);
              resources = addResources(resources, resourceGroupURI, resourcesForResourceGroup);
            }
          }
          setAzureRows(resources);
          setLoadingStatus('Done');
        } catch (error) {
          setLoadingStatus('Done');
          setErrorMessage(messageFromError(error));
        }
      };

      loadInitialData();
    }
  }, [resourcePickerData, internalSelectedURI, azureRows, loadingStatus]);

  // Map the selected item into an array of rows
  const selectedResourceRows = useMemo(() => {
    const found = internalSelectedURI && findRow(azureRows, internalSelectedURI);

    return found
      ? [
          {
            ...found,
            children: undefined,
          },
        ]
      : [];
  }, [internalSelectedURI, azureRows]);

  // Request resources for a expanded resource group
  const requestNestedRows = useCallback(
    async (resourceGroupOrSubscription: ResourceRow) => {
      // clear error message (also when loading cached resources)
      setErrorMessage(undefined);

      // If we already have children, we don't need to re-fetch them.
      if (resourceGroupOrSubscription.children?.length) {
        return;
      }

      try {
        const rows =
          resourceGroupOrSubscription.type === ResourceRowType.Subscription
            ? await resourcePickerData.getResourceGroupsBySubscriptionId(resourceGroupOrSubscription.id)
            : await resourcePickerData.getResourcesForResourceGroup(resourceGroupOrSubscription.id);

        const newRows = addResources(azureRows, resourceGroupOrSubscription.uri, rows);

        setAzureRows(newRows);
      } catch (error) {
        setErrorMessage(messageFromError(error));
        throw error;
      }
    },
    [resourcePickerData, azureRows]
  );

  const handleSelectionChanged = useCallback((row: ResourceRow, isSelected: boolean) => {
    isSelected ? setInternalSelectedURI(row.uri) : setInternalSelectedURI(undefined);
  }, []);

  const handleApply = useCallback(() => {
    onApply(internalSelectedURI);
  }, [internalSelectedURI, onApply]);

  return (
    <div>
      {loadingStatus === 'Started' ? (
        <div className={styles.loadingWrapper}>
          <LoadingPlaceholder text={'Loading...'} />
        </div>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr className={cx(styles.row, styles.header)}>
                <td className={styles.cell}>Scope</td>
                <td className={styles.cell}>Type</td>
                <td className={styles.cell}>Location</td>
              </tr>
            </thead>
          </table>

          <div className={styles.tableScroller}>
            <table className={styles.table}>
              <tbody>
                {azureRows.map((row) => (
                  <NestedRow
                    key={row.uri}
                    row={row}
                    selectedRows={selectedResourceRows}
                    level={0}
                    requestNestedRows={requestNestedRows}
                    onRowSelectedChange={handleSelectionChanged}
                    selectableEntryTypes={selectableEntryTypes}
                    scrollIntoView={true}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.selectionFooter}>
            {selectedResourceRows.length > 0 && (
              <>
                <h5>Selection</h5>

                <div className={styles.tableScroller}>
                  <table className={styles.table}>
                    <tbody>
                      {selectedResourceRows.map((row) => (
                        <NestedRow
                          key={row.uri}
                          row={row}
                          selectedRows={selectedResourceRows}
                          level={0}
                          requestNestedRows={requestNestedRows}
                          onRowSelectedChange={handleSelectionChanged}
                          selectableEntryTypes={selectableEntryTypes}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <Space v={2} />
              </>
            )}

            <Collapse
              collapsible
              label="Advanced"
              isOpen={isAdvancedOpen}
              onToggle={() => setIsAdvancedOpen(!isAdvancedOpen)}
            >
              <Label htmlFor={`input-${internalSelectedURI}`}>
                <h6>
                  Resource URI{' '}
                  <Tooltip
                    content={
                      <>
                        Manually edit the{' '}
                        <a
                          href="https://docs.microsoft.com/en-us/azure/azure-monitor/logs/log-standard-columns#_resourceid"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          resource uri.{' '}
                        </a>
                        Supports the use of multiple template variables (ex: /subscriptions/$subId/resourceGroups/$rg)
                      </>
                    }
                    placement="right"
                    interactive={true}
                  >
                    <Icon name="info-circle" />
                  </Tooltip>
                </h6>
              </Label>
              <Input
                id={`input-${internalSelectedURI}`}
                value={internalSelectedURI}
                onChange={(event) => setInternalSelectedURI(event.currentTarget.value)}
                placeholder="ex: /subscriptions/$subId"
              />
            </Collapse>
            <Space v={2} />

            <Button disabled={!!errorMessage} onClick={handleApply}>
              Apply
            </Button>

            <Space layout="inline" h={1} />

            <Button onClick={onCancel} variant="secondary">
              Cancel
            </Button>
          </div>
        </>
      )}
      {errorMessage && (
        <>
          <Space v={2} />
          <Alert severity="error" title="An error occurred while requesting resources from Azure Monitor">
            {errorMessage}
          </Alert>
        </>
      )}
    </div>
  );
};

export default ResourcePicker;
