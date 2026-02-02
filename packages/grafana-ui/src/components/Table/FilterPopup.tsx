import { css, cx } from '@emotion/css';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as React from 'react';

import { Field, GrafanaTheme2, SelectableValue } from '@grafana/data';

import { Button, ClickOutsideWrapper, IconButton, Label, Stack } from '..';
import { useStyles2, useTheme2 } from '../../themes';
import { Trans } from '../../utils/i18n';

import { FilterList } from './FilterList';
import { TableStyles } from './styles';
import { calculateUniqueFieldValues, getFilteredOptions, valuesToOptions } from './utils';

interface Props {
  column: any;
  tableStyles: TableStyles;
  onClose: () => void;
  field?: Field;
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  operator: SelectableValue<string>;
  setOperator: (item: SelectableValue<string>) => void;
  triggerRef?: React.RefObject<HTMLButtonElement>; // BMC Accessibility change: Added trigger ref to return focus on close
}

export const FilterPopup = ({
  column: { preFilteredRows, filterValue, setFilter },
  onClose,
  field,
  searchFilter,
  setSearchFilter,
  operator,
  setOperator,
  triggerRef,
}: Props) => {
  const theme = useTheme2();
  const uniqueValues = useMemo(() => calculateUniqueFieldValues(preFilteredRows, field), [preFilteredRows, field]);
  const options = useMemo(() => valuesToOptions(uniqueValues), [uniqueValues]);
  const filteredOptions = useMemo(() => getFilteredOptions(options, filterValue), [options, filterValue]);
  const [values, setValues] = useState<SelectableValue[]>(filteredOptions);
  const [matchCase, setMatchCase] = useState(false);
  const filterInputRef = useRef<HTMLInputElement>(null); // BMC Accessibility change: Ref for focus management

  // BMC Accessibility change Start: Move focus to filter input when dialog opens for screen reader and keyboard users
  useLayoutEffect(() => {
    const frameId = requestAnimationFrame(() => {
      filterInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  const returnFocusAndClose = useCallback(() => {
    onClose();
    requestAnimationFrame(() => {
      triggerRef?.current?.focus();
    });
  }, [onClose, triggerRef]);

  const onCancel = useCallback(() => returnFocusAndClose(), [returnFocusAndClose]);

  const onFilter = useCallback(
    (event: React.MouseEvent) => {
      const filtered = values.length ? values : undefined;
      setFilter(filtered);
      returnFocusAndClose();
    },
    [setFilter, values, returnFocusAndClose]
  );

  const onClearFilter = useCallback(
    (event: React.MouseEvent) => {
      setFilter(undefined);
      returnFocusAndClose();
    },
    [setFilter, returnFocusAndClose]
  );
  //BMC Accessibility Changes end
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
            {/* BMC Accessibility change: Pass ref for focus management */}
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
              filterInputRef={filterInputRef}
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
