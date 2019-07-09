import React, { ReactNode, PureComponent } from 'react';
import { ButtonSize } from '../Button/AbstractButton';
import { Button } from '../Button/Button';
import { GrafanaTheme } from '../../types/theme';
import { ThemeContext } from '../../themes/ThemeContext';
import { cx, css } from 'emotion';
import tinycolor from 'tinycolor2';
import { increaseContrast } from '../../utils/colors';
import { selectThemeVariant } from '../../themes/selectThemeVariant';

export interface ToggleButtonState {
  untouched: boolean;
  selected: boolean;
  value?: any;
  prevPropSelected: boolean;
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
      prevPropSelected: props.selected,
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

  static getDerivedStateFromProps(props: ToggleButtonProps, state: ToggleButtonState) {
    if (props.selected !== state.prevPropSelected) {
      return {
        selected: props.selected,
      };
    }
    return null;
  }

  renderButton(theme: GrafanaTheme) {
    const styles = getStyles(theme);
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
    return <ThemeContext.Consumer>{theme => this.renderButton(theme)}</ThemeContext.Consumer>;
  }
}

const getStyles = (theme: GrafanaTheme) => {
  const bg = theme.colors.bodyBg;
  const activeBg = increaseContrast(theme.colors.bodyBg, 5);
  const activeText = theme.colors.blueLight;
  const borderColor = selectThemeVariant({ dark: theme.colors.gray1, light: theme.colors.gray3 }, theme.type);

  return {
    button: css`
      border: 1px solid ${borderColor};
      color: ${theme.colors.textWeak};
      text-shadow: none;

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
