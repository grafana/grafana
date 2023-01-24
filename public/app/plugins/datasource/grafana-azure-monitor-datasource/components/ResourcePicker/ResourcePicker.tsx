import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { config } from '@grafana/runtime';
import { Alert, Button, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AzureMetricResource } from '../../types';
import messageFromError from '../../utils/messageFromError';
import { Space } from '../Space';

import Advanced from './Advanced';
import AdvancedMulti from './AdvancedMulti';
import NestedRow from './NestedRow';
import Search from './Search';
import getStyles from './styles';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from './types';
import { findRows, matchURI } from './utils';

interface ResourcePickerProps<T> {
  resources: T[];
  selectableEntryTypes: ResourceRowType[];
  searchLimit: number;

  fetchInitialRows: (selected: T[]) => Promise<ResourceRowGroup>;
  fetchAndAppendNestedRow: (rows: ResourceRowGroup, parentRow: ResourceRow) => Promise<ResourceRowGroup>;
  search: (term: string) => Promise<ResourceRowGroup>;
  onApply: (resources: T[]) => void;
  onCancel: () => void;
  disableRow: (row: ResourceRow, selectedRows: ResourceRowGroup) => boolean;
  renderAdvanced: (resources: T[], onChange: (resources: T[]) => void) => React.ReactNode;
  isValid: (r: T) => boolean;
  resourceToString: (r: T) => string;
  parseResourceDetails: (r: string, location?: string) => T;
}

const ResourcePicker = <T extends unknown>({
  resources,
  searchLimit,
  onApply,
  onCancel,
  selectableEntryTypes,
  disableRow,
  renderAdvanced,
  fetchInitialRows,
  fetchAndAppendNestedRow,
  isValid,
  resourceToString,
  parseResourceDetails,
  search,
}: ResourcePickerProps<T>) => {
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
        // const resources = await resourcePickerData.fetchInitialRows(
        //   queryType,
        //   parseMultipleResourceDetails(internalSelected ?? {})
        // );
        const resources = await fetchInitialRows(internalSelected ?? {});
        setRows(resources);
      } catch (error) {
        setErrorMessage(messageFromError(error));
      }
      setIsLoading(false);
    }
  }, [internalSelected, isLoading, fetchInitialRows]);

  useEffectOnce(() => {
    loadInitialData();
  });

  // Avoid using empty resources
  // const isValid = (r: string | AzureMetricResource) =>
  //   typeof r === 'string' ? r !== '' : r.subscription && r.resourceGroup && r.resourceName && r.metricNamespace;

  // set selected row data whenever row or selection changes
  useEffect(() => {
    if (!internalSelected) {
      setSelectedRows([]);
    }

    const sanitized = internalSelected.filter((r) => isValid(r));
    const found = internalSelected && findRows(rows, sanitized.map(resourceToString));
    if (found && found.length) {
      return setSelectedRows(found);
    }
    return setSelectedRows([]);
  }, [internalSelected, rows, isValid, resourceToString]);

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
        const nestedRows = await fetchAndAppendNestedRow(rows, parentRow);
        setRows(nestedRows);
      } catch (error) {
        setErrorMessage(messageFromError(error));
        throw error;
      }
    },
    [rows, fetchAndAppendNestedRow]
  );

  const handleSelectionChanged = useCallback(
    (row: ResourceRow, isSelected: boolean) => {
      if (isSelected) {
        const newRes = parseResourceDetails(row.uri, row.location);
        const newSelected = internalSelected ? internalSelected.concat(newRes) : [newRes];
        setInternalSelected(newSelected);
      } else {
        const newInternalSelected = internalSelected?.filter((r) => {
          return !matchURI(resourceToString(r), row.uri);
        });
        setInternalSelected(newInternalSelected);
      }
    },
    [internalSelected, setInternalSelected, parseResourceDetails, resourceToString]
  );

  const handleApply = useCallback(() => {
    if (internalSelected) {
      onApply(internalSelected);
    }
  }, [internalSelected, onApply]);

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
        const searchResults = await search(searchWord);
        setRows(searchResults);
        if (searchResults.length >= searchLimit) {
          setShouldShowLimitFlag(true);
        }
      } catch (err) {
        setErrorMessage(messageFromError(err));
      }
      setIsLoading(false);
    },
    [loadInitialData, searchLimit, search]
  );

  return (
    <div>
      <Search searchFn={handleSearch} />
      {shouldShowLimitFlag ? (
        <p className={styles.resultLimit}>Showing first {searchLimit} results</p>
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
                  disableRow={disableRow}
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
                      disableRow={() => false}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <Space v={2} />
          </>
        )}

        {config.featureToggles.azureMultipleResourcePicker ? (
          <AdvancedMulti
            resources={internalSelected}
            onChange={(r) => setInternalSelected(r)}
            renderAdvanced={renderAdvanced}
          />
        ) : (
          // Disabling eslint because this component will go away soon
          <Advanced
            // eslint-disable-next-line
            resources={internalSelected as Array<string | AzureMetricResource>}
            // eslint-disable-next-line
            onChange={(r) => setInternalSelected(r as T[])}
          />
        )}

        <Space v={2} />

        <Button
          disabled={!!errorMessage || !internalSelected.every(isValid)}
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
