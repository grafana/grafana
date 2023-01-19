import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { Alert, Button, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import ResourcePickerData, { ResourcePickerQueryType } from '../../resourcePicker/resourcePickerData';
import { AzureMetricResource } from '../../types';
import messageFromError from '../../utils/messageFromError';
import { Space } from '../Space';

import Advanced from './Advanced';
import NestedRow from './NestedRow';
import Search from './Search';
import getStyles from './styles';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from './types';
import { findRows, parseMultipleResourceDetails, resourcesToStrings, matchURI, resourceToString } from './utils';

interface ResourcePickerProps<T> {
  resourcePickerData: ResourcePickerData;
  resources: T[];
  selectableEntryTypes: ResourceRowType[];
  queryType: ResourcePickerQueryType;

  onApply: (resources: T[]) => void;
  onCancel: () => void;
}

const ResourcePicker = ({
  resourcePickerData,
  resources,
  onApply,
  onCancel,
  selectableEntryTypes,
  queryType,
}: ResourcePickerProps<string | AzureMetricResource>) => {
  const styles = useStyles2(getStyles);

  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<ResourceRowGroup>([]);
  const [selectedRows, setSelectedRows] = useState<ResourceRowGroup>([]);
  const [internalSelected, setInternalSelected] = useState(resources);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [shouldShowLimitFlag, setShouldShowLimitFlag] = useState(false);

  // Sync the resourceURI prop to internal state
  useEffect(() => {
    setInternalSelected(resources);
  }, [resources]);

  const loadInitialData = useCallback(async () => {
    if (!isLoading) {
      try {
        setIsLoading(true);
        const resources = await resourcePickerData.fetchInitialRows(
          queryType,
          parseMultipleResourceDetails(internalSelected ?? {})
        );
        setRows(resources);
      } catch (error) {
        setErrorMessage(messageFromError(error));
      }
      setIsLoading(false);
    }
  }, [internalSelected, isLoading, resourcePickerData, queryType]);

  useEffectOnce(() => {
    loadInitialData();
  });

  // set selected row data whenever row or selection changes
  useEffect(() => {
    if (!internalSelected) {
      setSelectedRows([]);
    }

    const found = internalSelected && findRows(rows, resourcesToStrings(internalSelected));
    if (found && found.length) {
      return setSelectedRows(found);
    }
    return setSelectedRows([]);
  }, [internalSelected, rows]);

  // Request resources for an expanded resource group
  const requestNestedRows = useCallback(
    async (parentRow: ResourceRow) => {
      // clear error message (also when loading cached resources)
      setErrorMessage(undefined);

      // If we already have children, we don't need to re-fetch them.
      if (parentRow.children?.length) {
        return;
      }

      try {
        const nestedRows = await resourcePickerData.fetchAndAppendNestedRow(rows, parentRow, queryType);
        setRows(nestedRows);
      } catch (error) {
        setErrorMessage(messageFromError(error));
        throw error;
      }
    },
    [resourcePickerData, rows, queryType]
  );

  const resourceIsString = resources?.length && typeof resources[0] === 'string';
  const handleSelectionChanged = useCallback(
    (row: ResourceRow, isSelected: boolean) => {
      if (isSelected) {
        const newRes = resourceIsString ? row.uri : parseMultipleResourceDetails([row.uri], row.location)[0];
        const newSelected = (internalSelected ? internalSelected.concat(newRes) : [newRes]).filter((r) => {
          // avoid setting empty resources
          return typeof r === 'string' ? r !== '' : r.subscription;
        });
        setInternalSelected(newSelected);
      } else {
        const newInternalSelected = internalSelected?.filter((r) => {
          return !matchURI(resourceToString(r), row.uri);
        });
        setInternalSelected(newInternalSelected);
      }
    },
    [resourceIsString, internalSelected, setInternalSelected]
  );

  const handleApply = useCallback(() => {
    if (internalSelected) {
      onApply(resourceIsString ? internalSelected : parseMultipleResourceDetails(internalSelected));
    }
  }, [resourceIsString, internalSelected, onApply]);

  const handleSearch = useCallback(
    async (searchWord: string) => {
      // clear errors and warnings
      setErrorMessage(undefined);
      setShouldShowLimitFlag(false);

      if (!searchWord) {
        loadInitialData();
        return;
      }

      try {
        setIsLoading(true);
        const searchResults = await resourcePickerData.search(searchWord, queryType);
        setRows(searchResults);
        if (searchResults.length >= resourcePickerData.resultLimit) {
          setShouldShowLimitFlag(true);
        }
      } catch (err) {
        setErrorMessage(messageFromError(err));
      }
      setIsLoading(false);
    },
    [loadInitialData, resourcePickerData, queryType]
  );

  return (
    <div>
      <Search searchFn={handleSearch} />
      {shouldShowLimitFlag ? (
        <p className={styles.resultLimit}>Showing first {resourcePickerData.resultLimit} results</p>
      ) : (
        <Space v={2} />
      )}

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
            {isLoading && (
              <tr className={cx(styles.row)}>
                <td className={styles.cell}>
                  <LoadingPlaceholder text={'Loading...'} />
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr className={cx(styles.row)}>
                <td className={styles.cell} aria-live="polite">
                  No resources found
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((row) => (
                <NestedRow
                  key={row.uri}
                  row={row}
                  selectedRows={selectedRows}
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
        {selectedRows.length > 0 && (
          <>
            <h5>Selection</h5>

            <div className={styles.tableScroller}>
              <table className={styles.table}>
                <tbody>
                  {selectedRows.map((row) => (
                    <NestedRow
                      key={row.uri}
                      row={row}
                      selectedRows={selectedRows}
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

        <Advanced resources={internalSelected} onChange={(r) => setInternalSelected(r)} />
        <Space v={2} />

        <Button
          disabled={!!errorMessage}
          onClick={handleApply}
          data-testid={selectors.components.queryEditor.resourcePicker.apply.button}
        >
          Apply
        </Button>

        <Space layout="inline" h={1} />

        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
      </div>

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
