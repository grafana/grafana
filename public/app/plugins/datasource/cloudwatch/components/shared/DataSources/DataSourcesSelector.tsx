import { useEffect, useState } from 'react';

import { EditorField } from '@grafana/plugin-ui';
import { Alert, Button, Checkbox, Label, LoadingPlaceholder, Modal, Space, useStyles2 } from '@grafana/ui';

import { type LogDataSource } from '../../../dataquery.gen';
import {
  type ListDataSourcesRequest,
  type ResourceResponse,
  type LogDataSourceResponse,
} from '../../../resources/types';
import getStyles from '../../styles';

import Search from './Search';

type DataSourcesSelectorProps = {
  selectedDataSources?: LogDataSource[];
  fetchDataSources: (
    params: Partial<ListDataSourcesRequest>
  ) => Promise<Array<ResourceResponse<LogDataSourceResponse>>>;
  onChange: (selectedDataSources: LogDataSource[]) => void;
  onBeforeOpen?: () => void;
};

const MAX_DATA_SOURCES = 10;

const toDataSourceKey = (dataSource: LogDataSource) => `${dataSource.name}.${dataSource.type}`;

export const DataSourcesSelector = ({
  fetchDataSources,
  onChange,
  onBeforeOpen,
  ...props
}: DataSourcesSelectorProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectableDataSources, setSelectableDataSources] = useState<LogDataSource[]>([]);
  const [draftSelectedDataSources, setDraftSelectedDataSources] = useState(props.selectedDataSources ?? []);
  const [searchPhrase, setSearchPhrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | undefined>(undefined);
  const [selectionError, setSelectionError] = useState<string | undefined>(undefined);
  const styles = useStyles2(getStyles);

  const selectionLimitReached = draftSelectedDataSources.length >= MAX_DATA_SOURCES;
  const listedSelectionCount = selectableDataSources.filter((dataSource) =>
    draftSelectedDataSources.some((selected) => toDataSourceKey(selected) === toDataSourceKey(dataSource))
  ).length;
  const allListedSelected = selectableDataSources.length > 0 && listedSelectionCount === selectableDataSources.length;
  const listedSelectionMixed = listedSelectionCount > 0 && !allListedSelected;

  useEffect(() => {
    if (!isModalOpen) {
      setDraftSelectedDataSources(props.selectedDataSources ?? []);
    }
  }, [isModalOpen, props.selectedDataSources]);

  const openModal = () => {
    setDraftSelectedDataSources(props.selectedDataSources ?? []);
    setIsModalOpen(true);
    searchFn(searchPhrase);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectionError(undefined);
    setFetchError(undefined);
  };

  const searchFn = async (searchTerm?: string) => {
    setIsLoading(true);
    setFetchError(undefined);
    try {
      const dataSources = await fetchDataSources({
        pattern: searchTerm,
      });
      setSelectableDataSources(
        dataSources.map((ds) => ({
          name: ds.value.name,
          type: ds.value.type,
        }))
      );
    } catch (err) {
      setSelectableDataSources([]);
      setFetchError('Unable to load data sources.');
    }
    setIsLoading(false);
  };

  const handleSelectCheckbox = (row: LogDataSource, isChecked: boolean) => {
    if (isChecked) {
      if (draftSelectedDataSources.length >= MAX_DATA_SOURCES) {
        setSelectionError(`You can select up to ${MAX_DATA_SOURCES} data sources.`);
        return;
      }

      const alreadySelected = draftSelectedDataSources.some((ds) => ds.name === row.name && ds.type === row.type);
      if (alreadySelected) {
        return;
      }

      setDraftSelectedDataSources([...draftSelectedDataSources, row]);
      setSelectionError(undefined);
      return;
    }

    setDraftSelectedDataSources(draftSelectedDataSources.filter((ds) => ds.name !== row.name || ds.type !== row.type));
    setSelectionError(undefined);
  };

  const handleSelectAllListed = () => {
    const selectedKeys = new Set(draftSelectedDataSources.map(toDataSourceKey));
    const unselectedListed = selectableDataSources.filter(
      (dataSource) => !selectedKeys.has(toDataSourceKey(dataSource))
    );
    const remainingSlots = MAX_DATA_SOURCES - draftSelectedDataSources.length;

    if (remainingSlots <= 0) {
      setSelectionError(`You can select up to ${MAX_DATA_SOURCES} data sources.`);
      return;
    }

    const added = unselectedListed.slice(0, remainingSlots);
    setDraftSelectedDataSources([...draftSelectedDataSources, ...added]);

    if (unselectedListed.length > remainingSlots) {
      setSelectionError(
        `Only ${remainingSlots} listed data source${remainingSlots !== 1 ? 's were' : ' was'} added. You can select up to ${MAX_DATA_SOURCES} data sources.`
      );
      return;
    }

    setSelectionError(undefined);
  };

  const handleListedSelectionChange = () => {
    if (!allListedSelected && !listedSelectionMixed) {
      handleSelectAllListed();
      return;
    }

    // Clicking the bulk selector while it is checked or indeterminate clears current selections.
    setDraftSelectedDataSources([]);
    setSelectionError(undefined);
  };

  const handleApply = () => {
    onChange(draftSelectedDataSources);
    closeModal();
  };

  const handleCancel = () => {
    setDraftSelectedDataSources(props.selectedDataSources ?? []);
    closeModal();
  };

  return (
    <>
      <Modal className={styles.modal} title="Select data sources" isOpen={isModalOpen} onDismiss={handleCancel}>
        <div className={styles.logGroupSelectionArea}>
          <div className={styles.searchField}>
            <EditorField label="Data source name or type">
              <Search
                searchFn={(phrase) => {
                  searchFn(phrase);
                  setSearchPhrase(phrase);
                }}
                searchPhrase={searchPhrase}
              />
            </EditorField>
          </div>
        </div>
        <Space layout="block" v={2} />
        {fetchError && <Alert title={fetchError} severity="error" topSpacing={1} />}
        {selectionError && <Alert title={selectionError} severity="warning" topSpacing={1} />}
        <Checkbox
          aria-label="Select listed data sources"
          value={allListedSelected}
          indeterminate={listedSelectionMixed}
          onChange={handleListedSelectionChange}
          disabled={
            isLoading || selectableDataSources.length === 0 || (selectionLimitReached && listedSelectionCount === 0)
          }
          label="Select listed data sources"
        />
        <Space layout="block" v={1} />
        <div>
          <div className={styles.tableScroller}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.row}>
                  <td className={styles.cell}>Data source</td>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr className={styles.row}>
                    <td className={styles.cell}>
                      <LoadingPlaceholder text={'Loading...'} />
                    </td>
                  </tr>
                )}
                {!isLoading && selectableDataSources.length === 0 && (
                  <tr className={styles.row}>
                    <td className={styles.cell}>No data sources found</td>
                  </tr>
                )}
                {!isLoading &&
                  selectableDataSources.map((row) => {
                    const isSelected = draftSelectedDataSources.some(
                      (ds) => ds.name === row.name && ds.type === row.type
                    );
                    return (
                      <tr className={styles.row} key={`${row.name}.${row.type}`}>
                        <td className={styles.cell}>
                          <div className={styles.nestedEntry}>
                            <Checkbox
                              id={`${row.name}.${row.type}`}
                              onChange={(ev) => handleSelectCheckbox(row, ev.currentTarget.checked)}
                              value={isSelected}
                              disabled={selectionLimitReached && !isSelected}
                            />
                            <Space layout="inline" h={2} />
                            <label
                              className={styles.logGroupSearchResults}
                              htmlFor={`${row.name}.${row.type}`}
                              title={`${row.name}.${row.type}`}
                            >
                              {`${row.name}.${row.type}`}
                            </label>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
        <Space layout="block" v={2} />
        <Label className={styles.logGroupCountLabel}>
          {draftSelectedDataSources.length} data source{draftSelectedDataSources.length !== 1 && 's'} selected
        </Label>
        <Space layout="block" v={1} />

        <Modal.ButtonRow>
          <Button onClick={handleCancel} variant="secondary" type="button" fill="outline">
            Cancel
          </Button>
          <Button onClick={handleApply} type="button">
            Add data sources
          </Button>
        </Modal.ButtonRow>
      </Modal>

      <div>
        <Button
          variant="secondary"
          onClick={() => {
            try {
              onBeforeOpen?.();
              openModal();
            } catch (err) {}
          }}
          type="button"
        >
          Select data sources
        </Button>
      </div>
    </>
  );
};
