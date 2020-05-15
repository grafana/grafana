import React, { ReactNode } from 'react';
import { cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { withTheme } from '../../themes/ThemeContext';
import { getSelectStyles } from './getSelectStyles';

class UnthemedValueContainer extends React.Component<any & { theme: GrafanaTheme }> {
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

export const ValueContainer = withTheme(UnthemedValueContainer);
