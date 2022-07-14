import { css } from '@emotion/css';
import React, { forwardRef, useEffect, useState, useRef } from 'react';
import { TableToggleCommonProps, Column, HeaderProps, Hooks, TableToggleAllRowsSelectedProps } from 'react-table';

import { useStyles2 } from '../../../themes';
import { Checkbox } from '../../Forms/Checkbox';

/** This Indeterminate Checkbox component has three states: unchecked, checked, and indeterminate.
 * In this indeterminate state, the checkbox appears as a box with a horizontal dash through it.
 * The indeterminate state is used on a select-all checkbox to indicate that one or more selectable
 * items in a table have been selected. This component is directly connected to React Table, which
 * will soon be implemented in Core. Used in combination with React Table's useRowSelect hook.
 * https://react-table.tanstack.com/docs/api/useRowSelect. But it can be tweaked for use in
 * non-React Table contexts by modifying the `useCheckboxes` hook.
 */

export interface Props {
  indeterminate?: boolean;
}

export const useCheckboxes = (hooks: Hooks) => {
  hooks.visibleColumns.push((columns: Column[]) => [
    {
      id: 'selection',
      width: '50px',
      className: 'checkbox',
      /* eslint-disable react/display-name */
      Header: ({ getToggleAllRowsSelectedProps }: HeaderProps<{}>) => (
        <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
      ),
      Cell: ({ row }: { row: { getToggleRowSelectedProps: () => TableToggleCommonProps } }) => (
        <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
      ),
    },
    ...columns,
  ]);
};

export const IndeterminateCheckbox = forwardRef<HTMLInputElement, Props>(
  ({ indeterminate, ...rest }: Partial<TableToggleAllRowsSelectedProps>, ref: React.Ref<HTMLInputElement>) => {
    const [isIndeterminate, setIsIndeterminate] = useState(false);
    const defaultRef = useRef(null);
    const resolvedRef = ref || defaultRef;
    const styles = useStyles2(getStyles);

    useEffect(() => {
      if (typeof resolvedRef === 'object' && resolvedRef.current) {
        resolvedRef.current.indeterminate = Boolean(indeterminate);
        resolvedRef.current.checked = Boolean(indeterminate);
        setIsIndeterminate(resolvedRef.current.indeterminate);
      }
    }, [resolvedRef, indeterminate]);

    const onChange = (e: React.FormEvent<HTMLInputElement>) =>
      rest.onChange ? rest.onChange({ ...e, target: e.currentTarget }) : undefined;

    return (
      <Checkbox
        ref={resolvedRef}
        {...rest}
        onChange={onChange}
        data-testid={isIndeterminate ? 'indeterminate' : 'not-indeterminate'}
        className={isIndeterminate ? styles.indeterminateDash : styles.default}
      />
    );
  }
);

const getStyles = () => {
  return {
    default: css`
      margin-right: 8px;
    `,
    indeterminateDash: css`
      ::before {
        content: '-';
        display: block;
        flex-direction: column;
        width: 17px;
        height: 17px;
        position: absolute;
      }
      ::after {
        content: '-';
        border: solid orange;
        border-width: 1.5px 0 0 0;
        position: absolute;
        content: '';
        top: 8%;
        left: 9.5%;
        margin-top: 6px;
        width: 13px;
        z-index: 2;
      }
      margin-right: 8px;
    `,
  };
};
