import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { GroupProps } from 'react-select';
import { stylesFactory, withTheme, selectThemeVariant } from '../../../themes';
import { Themeable } from '../../../types';

interface ExtendedGroupProps extends GroupProps<any>, Themeable {
  data: {
    label: string;
    expanded: boolean;
    options: any[];
  };
}

interface State {
  expanded: boolean;
}

const getSelectOptionGroupStyles = stylesFactory((theme: GrafanaTheme) => {
  const optionBorder = selectThemeVariant(
    {
      light: theme.colors.gray4,
      dark: theme.colors.dark9,
    },
    theme.type
  );
  return {
    header: css`
      display: flex;
      align-items: center;
      justify-content: flex-start;
      justify-items: center;
      cursor: pointer;
      padding: 7px 10px;
      width: 100%;
      border-bottom: 1px solid ${optionBorder};
      text-transform: capitalize;
    `,
    label: css`
      flex-grow: 1;
    `,
    icon: css`
      padding-right: 2px;
    `,
  };
});

class UnthemedSelectOptionGroup extends PureComponent<ExtendedGroupProps, State> {
  state = {
    expanded: false,
  };

  componentDidMount() {
    if (this.props.data.expanded) {
      this.setState({ expanded: true });
    } else if (this.props.selectProps && this.props.selectProps.value) {
      const { value } = this.props.selectProps.value;

      if (value && this.props.options.some(option => option.value === value)) {
        this.setState({ expanded: true });
      }
    }
  }

  componentDidUpdate(nextProps: ExtendedGroupProps) {
    if (nextProps.selectProps.inputValue !== '') {
      this.setState({ expanded: true });
    }
  }

  onToggleChildren = () => {
    this.setState(prevState => ({
      expanded: !prevState.expanded,
    }));
  };

  render() {
    const { children, label, theme } = this.props;
    const { expanded } = this.state;
    const styles = getSelectOptionGroupStyles(theme);
    const icon = expanded ? 'fa-caret-left' : 'fa-caret-down';
    return (
      <div>
        <div className={styles.header} onClick={this.onToggleChildren}>
          <span className={styles.label}>{label}</span>
          <i className={cx('fa', icon, styles.icon)} />{' '}
        </div>
        {expanded && children}
      </div>
    );
  }
}

export const SelectOptionGroup = withTheme(UnthemedSelectOptionGroup);
