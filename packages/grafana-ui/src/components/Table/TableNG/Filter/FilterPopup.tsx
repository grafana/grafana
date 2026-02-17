import { css } from '@emotion/css';
import { Dispatch, memo, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Field, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Button } from '../../../Button/Button';
import { ButtonSelect } from '../../../Dropdown/ButtonSelect';
import { FilterInput } from '../../../FilterInput/FilterInput';
import { Label } from '../../../Forms/Label';
import { Stack } from '../../../Layout/Stack/Stack';
import { FilterOperator, FilterType, TableRow } from '../types';
import { getDisplayName } from '../utils';

import { FilterList } from './FilterList';
import { calculateUniqueFieldValues, getFilteredOptions, operatorSelectableValues, valuesToOptions } from './utils';

interface Props {
  name: string;
  rows: TableRow[];
  filterValue?: Array<SelectableValue<unknown>>;
  setFilter: Dispatch<SetStateAction<FilterType>>;
  onClose: () => void;
  field?: Field;
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  operator: SelectableValue<FilterOperator>;
  setOperator: (item: SelectableValue<FilterOperator>) => void;
  buttonElement: HTMLButtonElement | null;
}

export const FilterPopup = memo(
  ({
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
    buttonElement,
  }: Props) => {
    const uniqueValues = useMemo(() => calculateUniqueFieldValues(rows, field), [rows, field]);
    const options = useMemo(() => valuesToOptions(uniqueValues), [uniqueValues]);
    const filteredOptions = useMemo(() => getFilteredOptions(options, filterValue), [options, filterValue]);
    const [values, setValues] = useState<SelectableValue[]>(filteredOptions);
    const [matchCase, setMatchCase] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const operators = Object.values(operatorSelectableValues());

    // focus the input on mount. autoFocus prop doesn't work on FilterInput, maybe due to the forwarded ref
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, []);

    useEffect(() => {
      function handleEscape(e: KeyboardEvent) {
        if (e.key === 'Escape') {
          onClose();
          buttonElement?.focus();
        }
      }
      document.addEventListener('keyup', handleEscape);

      return () => {
        document.removeEventListener('keyup', handleEscape);
      };
    }, [onClose, buttonElement]);

    const onFilter = useCallback(() => {
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
    }, [name, operator, searchFilter, setFilter, values, onClose]);

    const onClearFilter = useCallback(() => {
      setFilter((filter: FilterType) => {
        const newFilter = { ...filter };
        delete newFilter[name];
        return newFilter;
      });
      onClose();
    }, [name, setFilter, onClose]);

    // we can't directly use ClickOutsideWrapper here because the click and keyup
    // events are complex and need to be handled with care to avoid conflicts
    useEffect(() => {
      const onOutsideClick = (event: Event) => {
        const domNode = containerRef.current;
        if (!domNode) {
          return;
        }
        if (event.target instanceof Node && !domNode.contains(event.target)) {
          console.log('closing from outside click');
          onClose();
        }
      };
      window.addEventListener('click', onOutsideClick);
      return () => {
        window.removeEventListener('click', onOutsideClick);
      };
    }, [onClose]);

    const filterInputPlaceholder = t('grafana-ui.table.filter-popup-input-placeholder', 'Filter values');
    const clearFilterVisible = useMemo(() => filterValue !== undefined, [filterValue]);
    const styles = useStyles2(getStyles);

    return (
      <div
        className={styles.filterContainer}
        data-testid={selectors.components.Panels.Visualization.TableNG.Filters.Container}
        ref={containerRef}
      >
        <Stack direction="column">
          <Stack alignItems="center">{field && <Label className={styles.label}>{getDisplayName(field)}</Label>}</Stack>

          <Stack gap={1}>
            <div className={styles.inputContainer}>
              <FilterInput
                ref={inputRef}
                placeholder={filterInputPlaceholder}
                title={filterInputPlaceholder}
                onChange={setSearchFilter}
                value={searchFilter}
                suffix={
                  <ButtonSelect
                    className={styles.buttonSelectOverrides}
                    options={operators}
                    onChange={setOperator}
                    value={operator}
                    tooltip={operator.description}
                    narrow
                    root={containerRef.current ?? undefined}
                  />
                }
              />
            </div>
            <Button
              tooltip={t('grafana-ui.table.filter-popup-aria-label-match-case', 'Match case')}
              variant={matchCase ? 'primary' : 'secondary'}
              onClick={() => setMatchCase((s) => !s)}
              aria-pressed={matchCase}
              icon={'text-fields'}
            />
          </Stack>

          <FilterList
            onChange={setValues}
            values={values}
            options={options}
            caseSensitive={matchCase}
            searchFilter={searchFilter}
            operator={operator}
          />

          <Stack justifyContent="end" direction="row-reverse">
            <Button size="sm" onClick={onFilter}>
              <Trans i18nKey="grafana-ui.table.filter-popup-apply">Ok</Trans>
            </Button>
            <Button size="sm" variant="secondary" onClick={onClose}>
              <Trans i18nKey="grafana-ui.table.filter-popup-cancel">Cancel</Trans>
            </Button>
            {clearFilterVisible && (
              <Button fill="text" size="sm" onClick={onClearFilter}>
                <Trans i18nKey="grafana-ui.table.filter-popup-clear">Clear filter</Trans>
              </Button>
            )}
          </Stack>
        </Stack>
      </div>
    );
  }
);

FilterPopup.displayName = 'FilterPopup';

const getStyles = (theme: GrafanaTheme2) => ({
  filterContainer: css({
    label: 'filterContainer',
    width: '100%',
    minWidth: '320px',
    height: '100%',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(2),
    boxShadow: theme.shadows.z3,
    borderRadius: theme.shape.radius.default,
  }),
  label: css({
    marginBottom: 0,
  }),
  inputContainer: css({
    width: 300,
  }),
  buttonSelectOverrides: css({
    fontSize: 12,
    '&:hover, &:focus, &:active': {
      color: theme.colors.text.primary,
      background: 'transparent',
    },
  }),
});
