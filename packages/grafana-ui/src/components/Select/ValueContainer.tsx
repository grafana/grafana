import { cx } from '@emotion/css';
import React, { Component, ReactNode } from 'react';

import { GrafanaTheme } from '@grafana/data';

import { withTheme2 } from '../../themes/ThemeContext';

import { getSelectStyles } from './getSelectStyles';

class UnthemedValueContainer extends Component<any & { theme: GrafanaTheme }> {
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
    const { isMulti, theme } = this.props;
    const styles = getSelectStyles(theme);
    const className = cx(styles.valueContainer, isMulti && styles.valueContainerMulti);
    return <div className={className}>{children}</div>;
  }
}

export const ValueContainer = withTheme2(UnthemedValueContainer);
