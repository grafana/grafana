import { css, cx } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';

import { Field, GrafanaTheme2, SelectableValue } from '@grafana/data';

import { Button, ClickOutsideWrapper, HorizontalGroup, IconButton, Label, VerticalGroup } from '..';
import { useStyles2, useTheme2 } from '../../themes';

import { FilterList } from './FilterList';
import { TableStyles } from './styles';
import { calculateUniqueFieldValues, getFilteredOptions, valuesToOptions } from './utils';

interface Props {
  column: any;
  tableStyles: TableStyles;
  onClose: () => void;
  field?: Field;
}

export const FilterPopup = ({ column: { preFilteredRows, filterValue, setFilter }, onClose, field }: Props) => {
  const theme = useTheme2();
  const uniqueValues = useMemo(() => calculateUniqueFieldValues(preFilteredRows, field), [preFilteredRows, field]);
  const options = useMemo(() => valuesToOptions(uniqueValues), [uniqueValues]);
  const filteredOptions = useMemo(() => getFilteredOptions(options, filterValue), [options, filterValue]);
  const [values, setValues] = useState<SelectableValue[]>(filteredOptions);
  const [matchCase, setMatchCase] = useState(false);

  const onCancel = useCallback((event?: React.MouseEvent) => onClose(), [onClose]);

  const onFilter = useCallback(
    (event: React.MouseEvent) => {
      const filtered = values.length ? values : undefined;

      setFilter(filtered);
      onClose();
    },
    [setFilter, values, onClose]
  );

  const onClearFilter = useCallback(
    (event: React.MouseEvent) => {
      setFilter(undefined);
      onClose();
    },
    [setFilter, onClose]
  );

  const clearFilterVisible = useMemo(() => filterValue !== undefined, [filterValue]);
  const styles = useStyles2(getStyles);

  return (
    <ClickOutsideWrapper onClick={onCancel} useCapture={true}>
      {/* This is just blocking click events from bubbeling and should not have a keyboard interaction. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className={cx(styles.filterContainer)} onClick={stopPropagation}>
        <VerticalGroup spacing="lg">
          <VerticalGroup spacing="xs">
            <HorizontalGroup justify="space-between" align="center">
              <Label className={styles.label}>Filter by values:</Label>
              <IconButton
                name="text-fields"
                tooltip="Match case"
                style={{ color: matchCase ? theme.colors.text.link : theme.colors.text.disabled }}
                onClick={() => {
                  setMatchCase((s) => !s);
                }}
              />
            </HorizontalGroup>
            <div className={cx(styles.listDivider)} />
            <FilterList onChange={setValues} values={values} options={options} caseSensitive={matchCase} />
          </VerticalGroup>
          <HorizontalGroup spacing="lg">
            <HorizontalGroup>
              <Button size="sm" onClick={onFilter}>
                Ok
              </Button>
              <Button size="sm" variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            </HorizontalGroup>
            {clearFilterVisible && (
              <HorizontalGroup>
                <Button fill="text" size="sm" onClick={onClearFilter}>
                  Clear filter
                </Button>
              </HorizontalGroup>
            )}
          </HorizontalGroup>
        </VerticalGroup>
      </div>
    </ClickOutsideWrapper>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  filterContainer: css`
    label: filterContainer;
    width: 100%;
    min-width: 250px;
    height: 100%;
    max-height: 400px;
    background-color: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(2)};
    margin: ${theme.spacing(1)} 0;
    box-shadow: ${theme.shadows.z3};
    border-radius: ${theme.shape.radius.default};
  `,
  listDivider: css`
    label: listDivider;
    width: 100%;
    border-top: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(0.5, 2)};
  `,
  label: css`
    margin-bottom: 0;
  `,
});

const stopPropagation = (event: React.MouseEvent) => {
  event.stopPropagation();
};
