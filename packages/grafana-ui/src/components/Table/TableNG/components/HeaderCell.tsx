import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { type Field, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type Column, type SortDirection } from '@grafana/react-data-grid';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { getFieldTypeIcon } from '../../../../types/icon';
import { Dropdown } from '../../../Dropdown/Dropdown';
import { Icon } from '../../../Icon/Icon';
import { Stack } from '../../../Layout/Stack/Stack';
import { Menu } from '../../../Menu/Menu';
import { useAdHocTransformations } from '../../../PanelChrome/useAdHocTransformations';
import { Filter } from '../Filter/Filter';
import { type FilterType, type TableRow, type TableSummaryRow } from '../types';
import { getDisplayName } from '../utils';

const ORGANIZE_TRANSFORMATION_ID = 'organize';

/**
 * Hides a column by keeping a single panel-authored `organize` transformation in sync with the
 * set of hidden fields, rather than appending a new transformation per click.
 */
function useHideColumn(field: Field): (() => void) | undefined {
  const { enabled, adHocTransformations, replaceAdHoc } = useAdHocTransformations();

  const organize = useMemo(
    () => adHocTransformations.find((t) => t.id === ORGANIZE_TRANSFORMATION_ID),
    [adHocTransformations]
  );

  const hideColumn = useCallback(() => {
    const others = adHocTransformations.filter((t) => t.id !== ORGANIZE_TRANSFORMATION_ID);

    replaceAdHoc([
      ...others,
      {
        id: ORGANIZE_TRANSFORMATION_ID,
        options: {
          ...organize?.options,
          excludeByName: { ...organize?.options?.excludeByName, [field.name]: true },
        },
      },
    ]);
  }, [adHocTransformations, organize, replaceAdHoc, field.name]);

  return enabled ? hideColumn : undefined;
}

interface HeaderCellProps {
  column: Column<TableRow, TableSummaryRow>;
  rows: TableRow[];
  field: Field;
  direction?: SortDirection;
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  showTypeIcons?: boolean;
  selectFirstCell: () => void;
  disableKeyboardEvents?: boolean;
  parentIndex?: number;
  crossFilterRows: Record<string, TableRow[]>;
  crossFilterTailRows: TableRow[];
}

export const HeaderCell: React.FC<HeaderCellProps> = ({
  column,
  direction,
  disableKeyboardEvents,
  field,
  filter,
  rows,
  selectFirstCell,
  setFilter,
  showTypeIcons,
  parentIndex,
  crossFilterRows,
  crossFilterTailRows,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const headerCellWrap = field.config.custom?.wrapHeaderText ?? false;
  const styles = useStyles2(getStyles, headerCellWrap);
  const displayName = getDisplayName(field);
  const filterable = field.config.custom?.filterable ?? false;
  const hideColumn = useHideColumn(field);

  // we have to remove/reset the filter if the column is not filterable
  useEffect(() => {
    if (!filterable && filter[displayName]) {
      setFilter((filter: FilterType) => {
        const newFilter = { ...filter };
        delete newFilter[displayName];
        return newFilter;
      });
    }
  }, [filterable, displayName, filter, setFilter]);

  /* eslint-disable jsx-a11y/no-static-element-interactions */
  return (
    <Stack
      ref={ref}
      direction="row"
      gap={0.5}
      alignItems="center"
      onKeyDown={
        disableKeyboardEvents
          ? undefined
          : (ev) => {
              // unfortunately, react-data-grid's default keyboard behavior is not compatible with what we need
              // to do to make filter and sort keyboard accessible, so we have to stop the propagation of events here,
              // and add a way to "hook back in" to their behavior once you've reached the last tabbable element in the last header cell.
              ev.stopPropagation();

              if (!(ev.key === 'Tab' && !ev.shiftKey)) {
                return;
              }

              const tableTabbedElement = ev.target;
              if (!(tableTabbedElement instanceof HTMLElement)) {
                return;
              }

              const headerContent = ref.current;
              const headerCell = ref.current?.parentNode;
              const row = headerCell?.parentNode;
              const isLastElementInHeader =
                headerContent?.lastElementChild?.contains(tableTabbedElement) && headerCell === row?.lastElementChild;

              if (isLastElementInHeader) {
                selectFirstCell();
              }
            }
      }
    >
      {/* eslint-enable jsx-a11y/no-static-element-interactions */}
      {showTypeIcons && (
        <Icon className={styles.headerCellIcon} name={getFieldTypeIcon(field)} title={field?.type} size="sm" />
      )}
      <button tabIndex={0} className={styles.headerCellLabel} title={displayName}>
        {displayName}
        {direction && (
          <Icon className={styles.headerCellIcon} size="lg" name={direction === 'ASC' ? 'arrow-up' : 'arrow-down'} />
        )}
      </button>

      {filterable && (
        <Filter
          name={column.key}
          rows={rows}
          filter={filter}
          setFilter={setFilter}
          field={field}
          iconClassName={styles.headerCellIcon}
          parentIndex={parentIndex}
          crossFilterRows={crossFilterRows}
          crossFilterTailRows={crossFilterTailRows}
        />
      )}

      {hideColumn && (
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item
                label={t('grafana-ui.table.header-cell.hide-column', 'Hide column')}
                icon="eye-slash"
                onClick={hideColumn}
              />
            </Menu>
          }
          placement="bottom-start"
        >
          <button
            tabIndex={0}
            className={styles.headerCellMenuButton}
            aria-label={t('grafana-ui.table.header-cell.column-options', 'Column options')}
          >
            <Icon className={styles.headerCellIcon} name="ellipsis-v" size="sm" />
          </button>
        </Dropdown>
      )}
    </Stack>
  );
};

const getStyles = memoize((theme: GrafanaTheme2, headerTextWrap?: boolean) => ({
  headerCellLabel: css({
    all: 'unset',
    cursor: 'pointer',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: headerTextWrap ? 'pre-line' : 'nowrap',
    borderRadius: theme.spacing(0.25),
    lineHeight: '20px',
    '&:hover': {
      textDecoration: 'underline',
    },
    '&::selection': {
      backgroundColor: 'var(--rdg-background-color)',
      color: theme.colors.text.secondary,
    },
  }),
  headerCellIcon: css({
    color: theme.colors.text.secondary,
  }),
  headerCellMenuButton: css({
    all: 'unset',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    borderRadius: theme.spacing(0.25),
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
}));
