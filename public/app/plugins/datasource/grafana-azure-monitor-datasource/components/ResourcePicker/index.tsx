import React, { useCallback, useEffect, useMemo, useState } from 'react';
import NestedResourceTable from './NestedResourceTable';
import { Row, RowGroup } from './types';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import ResourcePickerData from '../../resourcePicker/resourcePickerData';
import { produce } from 'immer';
interface ResourcePickerProps {
  resourcePickerData: Pick<ResourcePickerData, 'getResourcePickerData' | 'getResourcesForResourceGroup'>;
  resourceUri: string;
  handleSelectResource: (row: Row, isSelected: boolean) => void;
}

const ResourcePicker = (props: ResourcePickerProps) => {
  const styles = useStyles2(getStyles);

  const [rows, setRows] = useState<RowGroup>({});

  const handleFetchInitialResources = useCallback(async () => {
    const initalRows = await props.resourcePickerData.getResourcePickerData();
    setRows(initalRows);
  }, [props.resourcePickerData]);

  useEffect(() => {
    handleFetchInitialResources();
  }, [handleFetchInitialResources]);

  const requestNestedRows = useCallback(
    async (resourceGroup: Row) => {
      // if we've already fetched resources for a resource group we don't need to re-fetch them
      if (resourceGroup.children && Object.keys(resourceGroup.children).length > 0) {
        return;
      }

      // fetch and set nested resources for the resourcegroup into the bigger state object
      const resources = await props.resourcePickerData.getResourcesForResourceGroup(resourceGroup);
      setRows(
        produce(rows, (draftState) => {
          (draftState[resourceGroup.subscriptionId].children as RowGroup)[resourceGroup.name].children = resources;
        })
      );
    },
    [props.resourcePickerData, rows]
  );

  const selectedResource = useMemo(() => {
    if (props.resourceUri && Object.keys(rows).length) {
      const matches = /\/subscriptions\/(?<subscriptionId>.+)\/resourceGroups\/(?<selectedResourceGroupName>.+)\/providers\/(?<cloud>.+)/.exec(
        props.resourceUri
      );
      if (matches && matches.groups) {
        const { subscriptionId, selectedResourceGroupName } = matches.groups;
        const allResourceGroups = rows[subscriptionId].children || {};
        const selectedResourceGroup = allResourceGroups[selectedResourceGroupName.toLowerCase()];
        const allResourcesInResourceGroup = selectedResourceGroup.children;

        if (!allResourcesInResourceGroup || Object.keys(allResourcesInResourceGroup).length === 0) {
          requestNestedRows(selectedResourceGroup);
          return {};
        }

        const matchingResource = allResourcesInResourceGroup[props.resourceUri];
        return {
          [props.resourceUri]: matchingResource,
        };
      }
    }
    return {};
  }, [props.resourceUri, rows, requestNestedRows]);

  const hasSelection = Object.keys(selectedResource).length > 0;

  return (
    <div>
      <NestedResourceTable
        rows={rows}
        requestNestedRows={requestNestedRows}
        onRowSelectedChange={props.handleSelectResource}
        selectedRows={selectedResource}
      />

      {hasSelection && (
        <div className={styles.selectionFooter}>
          <h5>Selection</h5>
          <NestedResourceTable
            noHeader={true}
            rows={selectedResource}
            requestNestedRows={requestNestedRows}
            onRowSelectedChange={props.handleSelectResource}
            selectedRows={selectedResource}
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
