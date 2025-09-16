import { cx } from '@emotion/css';
import { uniqBy } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';
import { useEffectOnce } from 'react-use';

import { LocalStorageValueProvider } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import {
  Alert,
  Button,
  LoadingPlaceholder,
  Modal,
  useStyles2,
  Space,
  Stack,
  Field,
  ComboboxOption,
  MultiCombobox,
  TabsBar,
  TabContent,
  Tab,
} from '@grafana/ui';

import { resourceTypeDisplayNames } from '../../azureMetadata/resourceTypes';
import Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import ResourcePickerData, { ResourcePickerQueryType } from '../../resourcePicker/resourcePickerData';
import { AzureMonitorResource } from '../../types/query';
import { ResourceGraphFilters } from '../../types/types';
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
  datasource: Datasource;

  onApply: (resources: T[]) => void;
  onCancel: () => void;
  disableRow: (row: ResourceRow, selectedRows: ResourceRowGroup) => boolean;
  renderAdvanced: (resources: T[], onChange: (resources: T[]) => void) => React.ReactNode;
  selectionNotice?: (selectedRows: ResourceRowGroup) => string;
}

export const RECENT_RESOURCES_KEY = (queryType: ResourcePickerQueryType) =>
  `grafana.datasources.azuremonitor.recent-resources.${queryType}`;

const ResourcePicker = ({
  resourcePickerData,
  resources,
  datasource,
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
  const [subscriptions, setSubscriptions] = useState<Array<ComboboxOption<string>>>([]);
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(false);
  const [namespaces, setNamespaces] = useState<Array<ComboboxOption<string>>>([]);
  const [isLoadingNamespaces, setIsLoadingNamespaces] = useState(false);
  const [locations, setLocations] = useState<Array<ComboboxOption<string>>>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [filters, setFilters] = useState<ResourceGraphFilters>({
    subscriptions: [],
    types: [],
    locations: [],
  });
  const [view, setView] = useState<'picker' | 'recent'>('picker');

  // Sync the resourceURI prop to internal state
  useEffect(() => {
    setInternalSelected(resources);
  }, [resources]);

  const loadFilterOptions = useCallback(async () => {
    setIsLoadingSubscriptions(true);
    const subscriptions = await datasource.getSubscriptions();
    setSubscriptions(subscriptions.map((sub) => ({ label: sub.text, value: sub.value })));
    setIsLoadingSubscriptions(false);

    if (queryType === 'metrics') {
      setIsLoadingNamespaces(true);
      const initialNamespaces = await datasource.getMetricNamespaces(
        subscriptions[0]?.value || datasource.getDefaultSubscriptionId()
      );
      setNamespaces(
        initialNamespaces?.map((ns) => ({
          label: resourceTypeDisplayNames[ns.value.toLowerCase()] || ns.value,
          value: ns.value,
        }))
      );
      setIsLoadingNamespaces(false);
    }

    setIsLoadingLocations(true);
    // We only retrieve locations from the first 3 subscriptions to avoid performance issues.
    const initialLocations = await datasource.getLocations(subscriptions.map((s) => s.value).slice(0, 3));
    setLocations(
      Array.from(initialLocations.values()).map((location) => ({
        label: location.displayName,
        value: location.name,
      }))
    );
    setIsLoadingLocations(false);
  }, [datasource, queryType]);

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
    if (config.featureToggles.azureResourcePickerUpdates) {
      loadFilterOptions();
    }
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
        const nestedRows = await resourcePickerData.fetchAndAppendNestedRow(rows, parentRow, queryType, filters);
        setRows(nestedRows);
      } catch (error) {
        setErrorMessage(messageFromError(error));
        throw error;
      }
    },
    [resourcePickerData, rows, queryType, filters]
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

  // Once the azureResourcePickerUpdates feature toggle is removed this will replace handleApply above
  const handleApplyWithLocalStorage = useCallback(
    (recentResources: ResourceRowGroup, onRecentResourcesSave: (value: ResourceRowGroup) => void) => {
      if (internalSelected) {
        const resourcesToSave = uniqBy([...selectedRows, ...recentResources], 'id');

        onRecentResourcesSave(resourcesToSave.slice(0, 30));
        onApply(queryType === 'logs' ? internalSelected : parseMultipleResourceDetails(internalSelected));
      }
    },
    [queryType, internalSelected, selectedRows, onApply]
  );

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
        const searchResults = await resourcePickerData.search(searchWord, queryType, filters);
        setRows(searchResults);
        if (searchResults.length >= resourcePickerData.resultLimit) {
          setShouldShowLimitFlag(true);
        }
      } catch (err) {
        setErrorMessage(messageFromError(err));
      }
      setIsLoading(false);
    },
    [loadInitialData, resourcePickerData, queryType, filters]
  );

  const loadFilteredRows = useCallback(
    async (filters: ResourceGraphFilters) => {
      try {
        setIsLoading(true);
        const filteredRows = await resourcePickerData.fetchInitialRows(queryType, undefined, filters);
        setRows(filteredRows);
      } catch (error) {
        setErrorMessage(messageFromError(error));
      }
      setIsLoading(false);
    },
    [resourcePickerData, queryType]
  );

  const updateFilters = (value: Array<ComboboxOption<string>>, filterType: 'subscriptions' | 'types' | 'locations') => {
    const updatedFilters = { ...filters };
    const values = value.map((v) => v.value);
    switch (filterType) {
      case 'subscriptions':
        updatedFilters.subscriptions = values;
        break;
      case 'types':
        updatedFilters.types = values;
        break;
      case 'locations':
        updatedFilters.locations = values;
        break;
    }
    setFilters(updatedFilters);
    reportInteraction('grafana_ds_azuremonitor_resource_picker_filters', {
      subscriptionsFilters: updatedFilters.subscriptions.length,
      typesFilters: updatedFilters.types.length,
      locationsFilters: updatedFilters.locations.length,
    });
    if (
      updatedFilters.subscriptions.length === 0 &&
      updatedFilters.types.length === 0 &&
      updatedFilters.locations.length === 0
    ) {
      loadInitialData();
      return;
    }
    loadFilteredRows(updatedFilters);
  };

  const resourceTable = (resourceRows: ResourceRowGroup) => {
    return (
      <>
        <table className={styles.table}>
          <thead>
            <tr className={cx(styles.row, styles.header)}>
              <td className={styles.cell}>
                <Trans i18nKey="components.resource-picker.header-scope">Scope</Trans>
              </td>
              <td className={styles.cell}>
                <Trans i18nKey="components.resource-picker.header-resource-group">Resource Group</Trans>
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
              {!isLoading && resourceRows?.length === 0 && (
                <tr className={cx(styles.row)}>
                  <td className={styles.cell} aria-live="polite">
                    {view === 'picker' ? (
                      <Trans i18nKey="components.resource-picker.text-no-resources">No resources found</Trans>
                    ) : (
                      <Trans i18nKey="components.resource-picker.text-no-recent-resources">
                        No recent resources found
                      </Trans>
                    )}
                  </td>
                </tr>
              )}
              {!isLoading &&
                resourceRows?.map((row) => (
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

          {view === 'picker' && (
            <AdvancedMulti
              resources={internalSelected}
              onChange={(r) => setInternalSelected(r)}
              renderAdvanced={renderAdvanced}
            />
          )}
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
        </footer>
      </>
    );
  };

  const baseResourcePicker = (
    recentResources?: ResourceRowGroup,
    localStorageSave?: (value: ResourceRowGroup) => void
  ) => {
    return (
      <>
        <Search searchFn={handleSearch} />
        {config.featureToggles.azureResourcePickerUpdates && (
          <Stack direction={'row'} alignItems="flex-start" justifyContent={'space-between'} gap={1}>
            <Field
              label={t('components.resource-picker.subscriptions-filter', 'Subscriptions')}
              noMargin
              className={styles.filterInput(queryType)}
            >
              <MultiCombobox
                aria-label={t('components.resource-picker.subscriptions-filter', 'Subscriptions')}
                value={filters.subscriptions}
                options={subscriptions}
                onChange={(value) => updateFilters(value, 'subscriptions')}
                isClearable
                enableAllOption
                loading={isLoadingSubscriptions}
                data-testid={selectors.components.queryEditor.resourcePicker.filters.subscription.input}
                placeholder={t('components.resource-picker.subscriptions-filter-placeholder', 'Select a subscription')}
              />
            </Field>
            {queryType === 'metrics' && (
              <Field
                label={t('components.resource-picker.types-filter', 'Resource Types')}
                noMargin
                className={styles.filterInput(queryType)}
              >
                <MultiCombobox
                  aria-label={t('components.resource-picker.types-filter', 'Resource Types')}
                  value={filters.types}
                  options={namespaces}
                  onChange={(value) => updateFilters(value, 'types')}
                  isClearable
                  enableAllOption
                  loading={isLoadingNamespaces}
                  data-testid={selectors.components.queryEditor.resourcePicker.filters.type.input}
                  placeholder={t('components.resource-picker.types-filter-placeholder', 'Select a resource type')}
                />
              </Field>
            )}
            <Field
              label={t('components.resource-picker.locations-filter', 'Locations')}
              noMargin
              className={styles.filterInput(queryType)}
            >
              <MultiCombobox
                aria-label={t('components.resource-picker.locations-filter', 'Locations')}
                value={filters.locations}
                options={locations}
                onChange={(value) => updateFilters(value, 'locations')}
                isClearable
                enableAllOption
                loading={isLoadingLocations}
                data-testid={selectors.components.queryEditor.resourcePicker.filters.location.input}
                placeholder={t('components.resource-picker.locations-filter-placeholder', 'Select a location')}
              />
            </Field>
          </Stack>
        )}
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

        {resourceTable(rows)}

        <Modal.ButtonRow>
          <Button onClick={onCancel} variant="secondary" fill="outline">
            <Trans i18nKey="components.resource-picker.button-cancel">Cancel</Trans>
          </Button>
          <Button
            disabled={!!errorMessage || !internalSelected.every(isValid)}
            onClick={
              localStorageSave && recentResources
                ? () => handleApplyWithLocalStorage(recentResources, localStorageSave)
                : handleApply
            }
            data-testid={selectors.components.queryEditor.resourcePicker.apply.button}
          >
            <Trans i18nKey="components.resource-picker.button-apply">Apply</Trans>
          </Button>
        </Modal.ButtonRow>
      </>
    );
  };

  // Once the azureResourcePickerUpdates feature toggle is removed, baseResourcePicker can be merged into this function
  const tabbedResourcePicker = () => {
    return (
      <LocalStorageValueProvider<ResourceRowGroup> storageKey={RECENT_RESOURCES_KEY(queryType)} defaultValue={[]}>
        {(recentResources, onRecentResourcesSave) => {
          return (
            <>
              <TabsBar>
                <Tab
                  key={'picker'}
                  label={t('components.resource-picker.browse-tab', 'Browse')}
                  active={view === 'picker'}
                  onChangeTab={() => setView('picker')}
                />
                <Tab
                  key={'recent'}
                  label={t('components.resource-picker.recent-tab', 'Recent')}
                  active={view === 'recent'}
                  onChangeTab={() => {
                    reportInteraction('grafana_ds_azuremonitor_resource_picker_recent_used', {
                      recentResourcesCount: recentResources.length,
                    });
                    setView('recent');
                  }}
                />
              </TabsBar>
              <TabContent style={{ margin: '10px' }}>
                {view === 'picker' && baseResourcePicker(recentResources, onRecentResourcesSave)}
                {view === 'recent' && (
                  <>
                    {resourceTable(recentResources)}

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
                  </>
                )}
              </TabContent>
            </>
          );
        }}
      </LocalStorageValueProvider>
    );
  };

  return config.featureToggles.azureResourcePickerUpdates ? tabbedResourcePicker() : baseResourcePicker();
};

export default ResourcePicker;
