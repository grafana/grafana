import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { Alert, Button, Icon, Input, LoadingPlaceholder, Tooltip, useStyles2, Collapse, Label } from '@grafana/ui';

import ResourcePickerData, { ResourcePickerQueryType } from '../../resourcePicker/resourcePickerData';
import messageFromError from '../../utils/messageFromError';
import { Space } from '../Space';

import NestedRow from './NestedRow';
import Search from './Search';
import getStyles from './styles';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from './types';
import { findRow } from './utils';

interface ResourcePickerProps {
  resourcePickerData: ResourcePickerData;
  resourceURI: string | undefined;
  selectableEntryTypes: ResourceRowType[];
  queryType: ResourcePickerQueryType;

  onApply: (resourceURI: string | undefined) => void;
  onCancel: () => void;
}

const ResourcePicker = ({
  resourcePickerData,
  resourceURI,
  onApply,
  onCancel,
  selectableEntryTypes,
  queryType,
}: ResourcePickerProps) => {
  const styles = useStyles2(getStyles);

  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<ResourceRowGroup>([]);
  const [selectedRows, setSelectedRows] = useState<ResourceRowGroup>([]);
  const [internalSelectedURI, setInternalSelectedURI] = useState<string | undefined>(resourceURI);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(resourceURI?.includes('$'));
  const [shouldShowLimitFlag, setShouldShowLimitFlag] = useState(false);

  // Sync the resourceURI prop to internal state
  useEffect(() => {
    setInternalSelectedURI(resourceURI);
  }, [resourceURI]);

  const loadInitialData = useCallback(async () => {
    if (!isLoading) {
      try {
        setIsLoading(true);
        const resources = await resourcePickerData.fetchInitialRows(queryType, internalSelectedURI || '');
        setRows(resources);
      } catch (error) {
        setErrorMessage(messageFromError(error));
      }
      setIsLoading(false);
    }
  }, [internalSelectedURI, isLoading, resourcePickerData, queryType]);

  useEffectOnce(() => {
    loadInitialData();
  });

  // set selected row data whenever row or selection changes
  useEffect(() => {
    if (!internalSelectedURI) {
      setSelectedRows([]);
    }

    const found = internalSelectedURI && findRow(rows, internalSelectedURI);
    if (found) {
      return setSelectedRows([
        {
          ...found,
          children: undefined,
        },
      ]);
    }
  }, [internalSelectedURI, rows]);

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

  const handleSelectionChanged = useCallback((row: ResourceRow, isSelected: boolean) => {
    isSelected ? setInternalSelectedURI(row.uri) : setInternalSelectedURI(undefined);
  }, []);

  const handleApply = useCallback(() => {
    onApply(internalSelectedURI);
  }, [internalSelectedURI, onApply]);

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
          <Space v={2} />
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
