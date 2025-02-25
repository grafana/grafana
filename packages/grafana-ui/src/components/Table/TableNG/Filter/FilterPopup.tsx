import { css, cx } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';

import { Field, GrafanaTheme2, SelectableValue } from '@grafana/data';

import { Button, ClickOutsideWrapper, IconButton, Label, Stack } from '../../..';
import { useStyles2, useTheme2 } from '../../../../themes';
import { Trans } from '../../../../utils/i18n';
import { FilterType } from '../types';

import { FilterList } from './FilterList';
import { calculateUniqueFieldValues, getFilteredOptions, valuesToOptions } from './utils';

interface Props {
  name: string;
  rows: any[];
  filterValue: any;
  setFilter: (value: any) => void;
  onClose: () => void;
  field?: Field;
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  operator: SelectableValue<string>;
  setOperator: (item: SelectableValue<string>) => void;
}

export const FilterPopup = ({
  name,
  rows,
  filterValue,
  setFilter,
  onClose,
  field,
  searchFilter,
  setSearchFilter,
  operator,
  setOperator,
}: Props) => {
  const theme = useTheme2();
  const uniqueValues = useMemo(() => calculateUniqueFieldValues(rows, field), [rows, field]);
  const options = useMemo(() => valuesToOptions(uniqueValues), [uniqueValues]);
  const filteredOptions = useMemo(() => getFilteredOptions(options, filterValue), [options, filterValue]);
  const [values, setValues] = useState<SelectableValue[]>(filteredOptions);
  const [matchCase, setMatchCase] = useState(false);

  const onCancel = useCallback((event?: React.MouseEvent) => onClose(), [onClose]);

  const onFilter = useCallback(
    (event: React.MouseEvent) => {
      if (values.length !== 0) {
        // create a Set for faster filtering
        const filteredSet = new Set(values.map((item) => item.value));

        setFilter((filter: FilterType) => ({
          ...filter,
          [name]: { filtered: values, filteredSet, searchFilter, operator },
        }));
      } else {
        setFilter((filter: FilterType) => {
          const newFilter = { ...filter };
          delete newFilter[name];
          return newFilter;
        });
      }
      onClose();
    },
    [setFilter, values, onClose] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onClearFilter = useCallback(
    (event: React.MouseEvent) => {
      setFilter((filter: FilterType) => {
        const newFilter = { ...filter };
        delete newFilter[name];
        return newFilter;
      });
      onClose();
    },
    [setFilter, onClose] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const clearFilterVisible = useMemo(() => filterValue !== undefined, [filterValue]);
  const styles = useStyles2(getStyles);

  return (
    <ClickOutsideWrapper onClick={onCancel} useCapture={true}>
      {/* This is just blocking click events from bubbeling and should not have a keyboard interaction. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div className={cx(styles.filterContainer)} onClick={stopPropagation}>
        <Stack direction="column" gap={3}>
          <Stack direction="column" gap={0.5}>
            <Stack justifyContent="space-between" alignItems="center">
              <Label className={styles.label}>
                <Trans i18nKey="grafana-ui.table.filter-popup-heading">Filter by values:</Trans>
              </Label>
              <IconButton
                name="text-fields"
                tooltip="Match case"
                style={{ color: matchCase ? theme.colors.text.link : theme.colors.text.disabled }}
                onClick={() => {
                  setMatchCase((s) => !s);
                }}
              />
            </Stack>
            <div className={cx(styles.listDivider)} />
            <FilterList
              onChange={setValues}
              values={values}
              options={options}
              caseSensitive={matchCase}
              showOperators={true}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              operator={operator}
              setOperator={setOperator}
            />
          </Stack>
          <Stack gap={3}>
            <Stack>
              <Button size="sm" onClick={onFilter}>
                <Trans i18nKey="grafana-ui.table.filter-popup-apply">Ok</Trans>
              </Button>
              <Button size="sm" variant="secondary" onClick={onCancel}>
                <Trans i18nKey="grafana-ui.table.filter-popup-cancel">Cancel</Trans>
              </Button>
            </Stack>
            {clearFilterVisible && (
              <Stack>
                <Button fill="text" size="sm" onClick={onClearFilter}>
                  <Trans i18nKey="grafana-ui.table.filter-popup-clear">Clear filter</Trans>
                </Button>
              </Stack>
            )}
          </Stack>
        </Stack>
      </div>
    </ClickOutsideWrapper>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  filterContainer: css({
    label: 'filterContainer',
    width: '100%',
    minWidth: '250px',
    height: '100%',
    maxHeight: '400px',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(2),
    boxShadow: theme.shadows.z3,
    borderRadius: theme.shape.radius.default,
  }),
  listDivider: css({
    label: 'listDivider',
    width: '100%',
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(0.5, 2),
  }),
  label: css({
    marginBottom: 0,
  }),
});

const stopPropagation = (event: React.MouseEvent) => {
  event.stopPropagation();
};
