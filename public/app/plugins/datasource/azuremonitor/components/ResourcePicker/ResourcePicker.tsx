import { cx } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';
import { useEffectOnce } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, LoadingPlaceholder, Modal, useStyles2, Space } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import ResourcePickerData, { ResourcePickerQueryType } from '../../resourcePicker/resourcePickerData';
import { AzureMonitorResource } from '../../types/query';
import messageFromError from '../../utils/messageFromError';

import AdvancedMulti from './AdvancedMulti';
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
  disableRow: (row: ResourceRow, selectedRows: ResourceRowGroup) => boolean;
  renderAdvanced: (resources: T[], onChange: (resources: T[]) => void) => React.ReactNode;
  selectionNotice?: (selectedRows: ResourceRowGroup) => string;
}

const ResourcePicker = ({
  resourcePickerData,
  resources,
  onApply,
  onCancel,
  selectableEntryTypes,
  queryType,
  disableRow,
  renderAdvanced,
  selectionNotice,
}: ResourcePickerProps<string | AzureMonitorResource>) => {
  const styles = useStyles2(getStyles);

  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<ResourceRowGroup>([]);
  const [selectedRows, setSelectedRows] = useState<ResourceRowGroup>([]);
  const [internalSelected, setInternalSelected] = useState(resources);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [shouldShowLimitFlag, setShouldShowLimitFlag] = useState(false);
  const selectionNoticeText = selectionNotice?.(selectedRows);

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

  // Avoid using empty resources
  const isValid = (r: string | AzureMonitorResource) =>
    typeof r === 'string' ? r !== '' : r.subscription && r.resourceGroup && r.resourceName && r.metricNamespace;

  // set selected row data whenever row or selection changes
  useEffect(() => {
    if (!internalSelected) {
      setSelectedRows([]);
    }

    const sanitized = internalSelected.filter((r) => isValid(r));
    const found = internalSelected && findRows(rows, resourcesToStrings(sanitized));
    if (sanitized?.length > found.length) {
      // Not all the selected items are in the current rows, so we need to generate the row
      // information for those.
      return setSelectedRows(resourcePickerData.parseRows(sanitized));
    }
    if (found && found.length) {
      return setSelectedRows(found);
    }
    return setSelectedRows([]);
  }, [internalSelected, rows, resourcePickerData]);

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

  const handleSelectionChanged = useCallback(
    (row: ResourceRow, isSelected: boolean) => {
      if (isSelected) {
        const newRes = queryType === 'logs' ? row.uri : parseMultipleResourceDetails([row.uri], row.location)[0];
        const newSelected = internalSelected ? internalSelected.concat(newRes) : [newRes];
        setInternalSelected(newSelected.filter((r) => isValid(r)));
      } else {
        const newInternalSelected = internalSelected?.filter((r) => {
          return !matchURI(resourceToString(r), row.uri);
        });
        setInternalSelected(newInternalSelected);
      }
    },
    [queryType, internalSelected, setInternalSelected]
  );

  const handleApply = useCallback(() => {
    if (internalSelected) {
      onApply(queryType === 'logs' ? internalSelected : parseMultipleResourceDetails(internalSelected));
    }
  }, [queryType, internalSelected, onApply]);

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
    <>
      <Search searchFn={handleSearch} />
      {shouldShowLimitFlag ? (
        <p className={styles.resultLimit}>
          <Trans
            i18nKey="components.resource-picker.result-limit"
            values={{ numResults: resourcePickerData.resultLimit }}
          >
            Showing first {'{{numResults}}'} results
          </Trans>
        </p>
      ) : (
        <Space v={2} />
      )}

      <table className={styles.table}>
        <thead>
          <tr className={cx(styles.row, styles.header)}>
            <td className={styles.cell}>
              <Trans i18nKey="components.resource-picker.header-scope">Scope</Trans>
            </td>
            <td className={styles.cell}>
              <Trans i18nKey="components.resource-picker.header-type">Type</Trans>
            </td>
            <td className={styles.cell}>
              <Trans i18nKey="components.resource-picker.header-location">Location</Trans>
            </td>
          </tr>
        </thead>
      </table>

      <div className={cx(styles.scrollableTable, styles.tableScroller)}>
        <table className={styles.table}>
          <tbody>
            {isLoading && (
              <tr className={cx(styles.row)}>
                <td className={styles.cell}>
                  <LoadingPlaceholder text={t('components.resource-picker.text-loading', 'Loading...')} />
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr className={cx(styles.row)}>
                <td className={styles.cell} aria-live="polite">
                  <Trans i18nKey="components.resource-picker.text-no-resources">No resources found</Trans>
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

      <footer className={styles.selectionFooter}>
        {selectedRows.length > 0 && (
          <>
            <h5>
              <Trans i18nKey="components.resource-picker.heading-selection">Selection</Trans>
            </h5>

            <div className={cx(styles.scrollableTable, styles.selectedTableScroller)}>
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
            {selectionNoticeText?.length ? (
              <Alert title="" severity="info">
                {selectionNoticeText}
              </Alert>
            ) : null}
          </>
        )}

        <AdvancedMulti
          resources={internalSelected}
          onChange={(r) => setInternalSelected(r)}
          renderAdvanced={renderAdvanced}
        />

        {errorMessage && (
          <>
            <Space v={2} />
            <Alert
              severity="error"
              title={t(
                'components.resource-picker.title-error-occurred',
                'An error occurred while requesting resources from Azure Monitor'
              )}
            >
              {errorMessage}
            </Alert>
          </>
        )}

        <Modal.ButtonRow>
          <Button onClick={onCancel} variant="secondary" fill="outline">
            <Trans i18nKey="components.resource-picker.button-cancel">Cancel</Trans>
          </Button>
          <Button
            disabled={!!errorMessage || !internalSelected.every(isValid)}
            onClick={handleApply}
            data-testid={selectors.components.queryEditor.resourcePicker.apply.button}
          >
            <Trans i18nKey="components.resource-picker.button-apply">Apply</Trans>
          </Button>
        </Modal.ButtonRow>
      </footer>
    </>
  );
};

export default ResourcePicker;
