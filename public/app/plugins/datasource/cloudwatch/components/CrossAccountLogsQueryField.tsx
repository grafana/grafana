import React, { useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField } from '@grafana/experimental';
import { Button, Checkbox, IconButton, LoadingPlaceholder, Modal, useStyles2 } from '@grafana/ui';

import Search from '../Search';
import { SelectableResourceValue } from '../api';
import { DescribeLogGroupsRequest } from '../types';

import { Account, ALL_ACCOUNTS_OPTION } from './Account';
import getStyles from './styles';

type CrossAccountLogsQueryProps = {
  selectedLogGroups: SelectableResourceValue[];
  accountOptions: Array<SelectableValue<string>>;
  fetchLogGroups: (params: Partial<DescribeLogGroupsRequest>) => Promise<SelectableResourceValue[]>;
  onChange: (selectedLogGroups: SelectableResourceValue[]) => void;
  onRunQuery: () => void;
};

export const CrossAccountLogsQueryField = (props: CrossAccountLogsQueryProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectableLogGroups, setSelectableLogGroups] = useState<SelectableResourceValue[]>([]);
  const [selectedLogGroups, setSelectedLogGroups] = useState(props.selectedLogGroups);
  const [searchPhrase, setSearchPhrase] = useState('');
  const [searchAccountId, setSearchAccountId] = useState(ALL_ACCOUNTS_OPTION.value);
  const [isLoading, setIsLoading] = useState(false);
  const styles = useStyles2(getStyles);
  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
    if (isModalOpen) {
      props.onRunQuery();
    } else {
      setSelectedLogGroups(props.selectedLogGroups);
      searchFn(searchPhrase, searchAccountId);
    }
  };

  const searchFn = async (searchTerm?: string, accountId?: string) => {
    setIsLoading(true);
    try {
      const possibleLogGroups = await props.fetchLogGroups({
        logGroupPattern: searchTerm,
        accountId: accountId,
      });
      setSelectableLogGroups(possibleLogGroups);
    } catch (err) {
      setSelectableLogGroups([]);
    }
    setIsLoading(false);
  };

  const handleSelectCheckbox = (row: SelectableResourceValue, isChecked: boolean) => {
    if (isChecked) {
      setSelectedLogGroups([...selectedLogGroups, row]);
    } else {
      setSelectedLogGroups(selectedLogGroups.filter((lg) => lg.value !== row.value));
    }
  };

  const handleApply = () => {
    props.onChange(selectedLogGroups);
    toggleModal();
  };

  const handleCancel = () => {
    setSelectedLogGroups(props.selectedLogGroups);
    toggleModal();
  };

  const accountNameById = useMemo(() => {
    const idsToNames: Record<string, string> = {};
    props.accountOptions.forEach((a) => {
      if (a.value && a.label) {
        idsToNames[a.value] = a.label;
      }
    });
    return idsToNames;
  }, [props.accountOptions]);

  return (
    <>
      <Modal className={styles.modal} title="Select Log Groups" isOpen={isModalOpen} onDismiss={toggleModal}>
        <div className={styles.logGroupSelectionArea}>
          <EditorField label="Log Group Name">
            <Search
              searchFn={(phrase) => {
                searchFn(phrase, searchAccountId);
                setSearchPhrase(phrase);
              }}
              searchPhrase={searchPhrase}
            />
          </EditorField>
          <Account
            onChange={(accountId?: string) => {
              searchFn(searchPhrase, accountId);
              setSearchAccountId(accountId || ALL_ACCOUNTS_OPTION.value);
            }}
            accountOptions={props.accountOptions}
            accountId={searchAccountId}
          />
        </div>
        <div>
          <div className={styles.tableScroller}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.row}>
                  <td className={styles.cell}>Log Group</td>
                  <td className={styles.cell}>Account name</td>
                  <td className={styles.cell}>Account ID</td>
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
                {!isLoading && selectableLogGroups.length === 0 && (
                  <tr className={styles.row}>
                    <td className={styles.cell}>No log groups found</td>
                  </tr>
                )}
                {!isLoading &&
                  selectableLogGroups.map((row) => (
                    <tr className={styles.row} key={`${row.value}`}>
                      <td className={styles.cell}>
                        <Checkbox
                          id={row.value}
                          onChange={(ev) => handleSelectCheckbox(row, ev.currentTarget.checked)}
                          value={!!(row.value && selectedLogGroups.some((lg) => lg.value === row.value))}
                        />
                        <label className={styles.logGroupSearchResults} htmlFor={row.value}>
                          {row.label}
                        </label>
                      </td>
                      <td className={styles.cell}>{accountNameById[row.text]}</td>
                      <td className={styles.cell}>{row.text}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <Button onClick={handleApply} type="button" className={styles.addBtn}>
            Add log groups
          </Button>
          <Button onClick={handleCancel} type="button">
            Cancel
          </Button>
        </div>
      </Modal>

      <div>
        <Button variant="secondary" onClick={toggleModal} type="button">
          Select Log Groups
        </Button>
      </div>

      <div>
        {props.selectedLogGroups.map((lg) => (
          <div key={lg.value} className={styles.selectedLogGroup}>
            {lg.label}
            <IconButton
              size="sm"
              name="times"
              className={styles.removeButton}
              onClick={() => props.onChange(props.selectedLogGroups.filter((slg) => slg.value !== lg.value))}
            />
          </div>
        ))}
      </div>
    </>
  );
};
