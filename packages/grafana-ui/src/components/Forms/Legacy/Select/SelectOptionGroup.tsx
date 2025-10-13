import { css } from '@emotion/css';
import { PureComponent } from 'react';
import { GroupProps } from 'react-select';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory, withTheme2 } from '../../../../themes';
import { Themeable2 } from '../../../../types';
import { Icon } from '../../../Icon/Icon';

interface ExtendedGroupProps extends Omit<GroupProps<any, any>, 'theme'>, Themeable2 {
  data: {
    label: string;
    expanded: boolean;
    options: any[];
  };
}

interface State {
  expanded: boolean;
}

const getSelectOptionGroupStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    header: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      justifyItems: 'center',
      cursor: 'pointer',
      padding: '7px 10px',
      width: '100%',
      borderBottom: `1px solid ${theme.colors.background.secondary}`,

      '&:hover': {
        color: theme.colors.text.maxContrast,
      },
    }),
    label: css({
      flexGrow: 1,
    }),
    icon: css({
      paddingRight: '2px',
    }),
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

      if (value && this.props.options.some((option) => option.value === value)) {
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
    this.setState((prevState) => ({
      expanded: !prevState.expanded,
    }));
  };

  render() {
    const { children, label, theme } = this.props;
    const { expanded } = this.state;
    const styles = getSelectOptionGroupStyles(theme);

    return (
      <div>
        {/*React Select doesn't support focusable option group headers, this will be skipped when using
      the keyboard */}
        <div className={styles.header} onClick={this.onToggleChildren} role="presentation">
          <span className={styles.label}>{label}</span>
          <Icon className={styles.icon} name={expanded ? 'angle-up' : 'angle-down'} />
        </div>
        {expanded && children}
      </div>
    );
  }
}

export const SelectOptionGroup = withTheme2(UnthemedSelectOptionGroup);
