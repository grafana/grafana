import React, { ReactNode, PureComponent } from 'react';
import { ButtonSize } from '../Button/AbstractButton';
import { Button } from '../Button/Button';
import { GrafanaTheme } from '../../types/theme';
import { ThemeContext } from '../../themes/ThemeContext';
import { Tooltip } from '../Tooltip/Tooltip';
import { cx, css } from 'emotion';
import tinycolor from 'tinycolor2';
import { increaseContrast } from '../../utils/colors';

export interface ToggleButtonState {
  untouched: boolean;
  selected: boolean;
  value?: any;
}

export interface ToggleButtonProps {
  onChange?: (value: any) => void;
  selected: boolean;
  value?: any;
  className?: string;
  children: ReactNode;
  tooltip?: string;
  key?: any;
  size?: ButtonSize;
  // To only base the buttons state on the props, rather than internal state
  controlled?: boolean;
}

export class ToggleButton extends PureComponent<ToggleButtonProps, ToggleButtonState> {
  constructor(props: ToggleButtonProps) {
    super(props);
    this.state = {
      untouched: true,
      selected: props.selected,
      value: props.value,
    };

    this.handleBlur = this.handleBlur.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(e: React.SyntheticEvent) {
    e.stopPropagation();

    this.setState(prevState => ({
      untouched: false,
      selected: this.props.controlled ? this.props.selected : !prevState.selected,
    }));
    if (this.props.onChange) {
      this.props.onChange(this.state);
    }
  }

  handleBlur() {
    this.setState({
      untouched: true,
    });
  }

  componentDidUpdate(prevProps: ToggleButtonProps) {
    //Override internal select toggle if props are updated
    if (prevProps.selected !== this.props.selected) {
      this.setState({
        selected: this.props.selected,
      });
    }
  }

  renderButton(theme: GrafanaTheme) {
    const styles = getStyles(theme, this.props.size);
    const { children, className, tooltip } = this.props;
    const activeStyle = this.state.selected ? styles.active : null;

    return (
      <Button
        variant="transparent"
        onBlur={this.handleBlur}
        className={cx([styles.button, activeStyle, className, this.state.untouched ? styles.focus : styles.unFocused])}
        onClick={this.handleClick}
        tooltip={tooltip}
        {...this.props}
      >
        <span>{children}</span>
      </Button>
    );
  }

  render() {
    const { tooltip } = this.props;

    const button = <ThemeContext.Consumer>{theme => this.renderButton(theme)}</ThemeContext.Consumer>;

    if (tooltip) {
      return (
        <Tooltip content={tooltip} placement="bottom">
          {button}
        </Tooltip>
      );
    } else {
      return button;
    }
  }
}

export const getButtonSize = (size: ButtonSize = 'md') => {
  switch (size) {
    case 'lg':
      return { padding: 20, height: 40 };
    case 'sm':
      return { padding: 12, height: 32 };
    case 'xs':
      return { padding: 8, height: 28 };
    case 'xl':
      return { padding: 24, height: 44 };
    case 'md':
    default:
      return { padding: 16, height: 36 };
  }
};

const getStyles = (theme: GrafanaTheme, buttonSize?: ButtonSize) => {
  const bg = theme.colors.bodyBg;
  const activeBg = increaseContrast(theme.colors.bodyBg, 5);
  const activeText = theme.colors.blueLight;
  const borderColor = theme.isDark ? theme.colors.gray1 : theme.colors.gray2;

  return {
    button: css`
      border: 1px solid ${borderColor};
      color: ${theme.colors.textWeak};

      background-color: ${bg};

      /*Make borders overlap*/
      margin-left: -1px;

      /*Position to enable z-index*/
      position: relative;
      z-index: 899;
      &:hover {
        color: ${theme.colors.blueLight};
        background-color: ${tinycolor.mix(theme.colors.blueShade, activeBg, 90).toString()};
      }
    `,
    active: css`
      background-color: ${activeBg};
      color: ${activeText};
      border-color: ${theme.colors.blueLight};
      /*To priorotize blue overlapping border*/
      z-index: 900;
    `,
    focus: css`
      &:focus {
        outline: none;
        z-index: 900;
        background-color: ${tinycolor.mix(theme.colors.blueShade, activeBg, 90).toString()};
        color: ${activeText};
        border-color: ${theme.colors.blueBase};
      }
    `,
    unFocused: css`
      &:focus {
        outline: none;
      }
    `,
  };
};
