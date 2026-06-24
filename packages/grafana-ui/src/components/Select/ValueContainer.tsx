import { cx } from '@emotion/css';
import { useEffect, useRef, type ReactNode } from 'react';
import { type ValueContainerProps as BaseValueContainerProps, type GroupBase } from 'react-select';

import { useStyles2 } from '../../themes/ThemeContext';

import { getSelectStyles } from './getSelectStyles';
import type { CustomComponentProps } from './types';

type ValueContainerProps<Option, IsMulti extends boolean, Group extends GroupBase<Option>> = BaseValueContainerProps<
  Option,
  IsMulti,
  Group
> &
  CustomComponentProps<Option, IsMulti, Group>;

export const ValueContainer = <Option, IsMulti extends boolean, Group extends GroupBase<Option>>({
  children,
  selectProps,
  isMulti,
}: ValueContainerProps<Option, IsMulti, Group>) => {
  const styles = useStyles2(getSelectStyles);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && selectProps.autoWidth && !selectProps.maxVisibleValues) {
      // Reset in order to measure the new width
      ref.current.style.minWidth = '0px';

      const width = ref.current.offsetWidth;

      ref.current.style.minWidth = `${width}px`;
    }
  }, [selectProps.value, selectProps.autoWidth, selectProps.maxVisibleValues]);

  const renderContainer = (containerChildren?: ReactNode) => {
    const noWrap = selectProps?.noMultiValueWrap && !selectProps?.menuIsOpen;
    const dataTestid = selectProps['data-testid'];
    const className = cx(styles.valueContainer, {
      [styles.valueContainerMulti]: isMulti && !noWrap,
      [styles.valueContainerMultiNoWrap]: isMulti && noWrap,
    });

    return (
      <div ref={ref} data-testid={dataTestid} className={className}>
        {containerChildren}
      </div>
    );
  };

  if (
    selectProps &&
    Array.isArray(children) &&
    Array.isArray(children[0]) &&
    selectProps.maxVisibleValues !== undefined &&
    !(selectProps.showAllSelectedWhenOpen && selectProps.menuIsOpen)
  ) {
    const [valueChildren, ...otherChildren] = children;
    const truncatedValues = valueChildren.slice(0, selectProps.maxVisibleValues);

    return renderContainer([truncatedValues, ...otherChildren]);
  }

  return renderContainer(children);
};
