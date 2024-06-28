import { cx } from '@emotion/css';
import { Component, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { withTheme2 } from '../../themes/ThemeContext';

import { getSelectStyles } from './getSelectStyles';

class UnthemedValueContainer extends Component<any & { theme: GrafanaTheme2 }> {
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
      <div data-testid={dataTestid} className={className}>
        {children}
      </div>
    );
  }
}

export const ValueContainer = withTheme2(UnthemedValueContainer);
