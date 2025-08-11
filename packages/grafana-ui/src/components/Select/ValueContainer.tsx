import { cx } from '@emotion/css';
import { isEqual } from 'lodash';
import { Component, createRef, ReactNode } from 'react';
import { ValueContainerProps as BaseValueContainerProps, type GroupBase } from 'react-select';

import { GrafanaTheme2 } from '@grafana/data';

import { withTheme2 } from '../../themes/ThemeContext';

import { getSelectStyles } from './getSelectStyles';
import type { CustomComponentProps } from './types';

type ValueContainerProps<Option, isMulti extends boolean, Group extends GroupBase<Option>> = BaseValueContainerProps<
  Option,
  isMulti,
  Group
> &
  CustomComponentProps<Option, isMulti, Group>;

class UnthemedValueContainer<Option, isMulti extends boolean, Group extends GroupBase<Option>> extends Component<
  ValueContainerProps<Option, isMulti, Group> & { theme: GrafanaTheme2 }
> {
  private ref = createRef<HTMLDivElement>();

  componentDidUpdate(prevProps: ValueContainerProps<Option, isMulti, Group>) {
    if (
      this.ref.current &&
      this.props.selectProps.autoWidth &&
      !isEqual(prevProps.selectProps.value, this.props.selectProps.value)
    ) {
      // Reset in order to measure the new width
      this.ref.current.style.minWidth = '0px';

      const width = this.ref.current.offsetWidth;

      this.ref.current.style.minWidth = `${width}px`;
    }
  }

  render() {
    const { children } = this.props;
    const { selectProps } = this.props;

    if (
      selectProps &&
      Array.isArray(children) &&
      Array.isArray(children[0]) &&
      selectProps.maxVisibleValues !== undefined &&
      !(selectProps.showAllSelectedWhenOpen && selectProps.menuIsOpen)
    ) {
      const [valueChildren, ...otherChildren] = children;
      const truncatedValues = valueChildren.slice(0, selectProps.maxVisibleValues);

      return this.renderContainer([truncatedValues, ...otherChildren]);
    }

    return this.renderContainer(children);
  }

  renderContainer(children?: ReactNode) {
    const { isMulti, theme, selectProps } = this.props;
    const noWrap = this.props.selectProps?.noMultiValueWrap && !this.props.selectProps?.menuIsOpen;
    const styles = getSelectStyles(theme);
    const dataTestid = selectProps['data-testid'];
    const className = cx(styles.valueContainer, {
      [styles.valueContainerMulti]: isMulti && !noWrap,
      [styles.valueContainerMultiNoWrap]: isMulti && noWrap,
    });

    return (
      <div ref={this.ref} data-testid={dataTestid} className={className}>
        {children}
      </div>
    );
  }
}

export const ValueContainer = withTheme2(UnthemedValueContainer);
