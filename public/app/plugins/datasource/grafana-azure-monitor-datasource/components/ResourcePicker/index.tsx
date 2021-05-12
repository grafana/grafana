import React, { useCallback, useEffect, useState } from 'react';
import NestedResourceTable from './NestedResourceTable';
import { Row, RowGroup } from './types';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data'; // TODO: this is not loading for me
import { useStyles2 } from '@grafana/ui';
import ResourcePickerData from '../../resource_picker/resource_picker_data';

interface ResourcePickerProps {
  resourcePickerData: Pick<ResourcePickerData, 'getResourcePickerData' | 'getResourcePickerDataWithNestedResourceData'>;
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

  const fetchNested = async (resourceGroup: Row) => {
    const rowsWithNestedData = await props.resourcePickerData.getResourcePickerDataWithNestedResourceData(
      resourceGroup
    );
    setRows(rowsWithNestedData);
  };

  const [selectedRows, setSelectedRows] = useState<RowGroup>({});
  const hasSelection = Object.keys(selectedRows).length > 0;
  const handleRowSelectedChange = useCallback((row: Row, isSelected: boolean) => {
    setSelectedRows(isSelected ? { [row.id]: row } : {});
  }, []);

  return (
    <div>
      <NestedResourceTable
        rows={rows}
        fetchNested={fetchNested}
        onRowSelectedChange={handleRowSelectedChange}
        selectedRows={selectedRows}
      />

      {hasSelection && (
        <div className={styles.selectionFooter}>
          <h5>Selection</h5>
          <NestedResourceTable
            noHeader={true}
            rows={selectedRows}
            fetchNested={fetchNested}
            onRowSelectedChange={handleRowSelectedChange}
            selectedRows={selectedRows}
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
