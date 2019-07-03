import React, { ReactNode, PureComponent } from 'react';
import { Tooltip } from '../Tooltip/Tooltip';
import { ThemeContext } from '../../themes/index';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '../../types/theme';
import tinycolor from 'tinycolor2';

interface ToggleButtonGroupProps {
  label?: string;
  children: JSX.Element[];
  transparent?: boolean;
  active?: number;
}

interface ToggleButtonGroupState {
  active: any;
}

export class ToggleButtonGroup extends PureComponent<ToggleButtonGroupProps, ToggleButtonGroupState> {
  constructor(props: ToggleButtonGroupProps) {
    super(props);
    this.state = {
      active: props.active || null,
    };
  }

  renderChildren(theme: GrafanaTheme) {
    const styles = getStyles(theme);
    return (
      <>
        {React.Children.map(this.props.children, (child: any, index) => {
          // Set correct style depending on first/middle/last
          const style =
            index === 0 ? styles.first : index === this.props.children.length - 1 ? styles.last : styles.middle;

          return React.cloneElement(child, {
            className: style,
          });
        })}
      </>
    );
  }

  render() {
    return <ThemeContext.Consumer>{theme => this.renderChildren(theme)}</ThemeContext.Consumer>;
  }
}

const getStyles = (theme: GrafanaTheme) => {
  const borderRadius = 2;
  const bg = theme.colors.bodyBg;
  const activeBg = increaseContrast(theme.colors.bodyBg, 10);
  const activeText = theme.colors.blueBase;
  return {
    button: css`
      border: solid 1px #c7d0d9;
      color: ${theme.colors.text};
      padding: 0 16px;
      background-color: ${bg};
      border-radius: ${borderRadius}px;
      height: 36px;
      font-size: 14px;
      font-weight: normal;
      /*Make borders overlap*/
      margin-left: -1px;

      /*Position to enable z-index*/
      position: relative;
      z-index: 899;
      &:hover {
        color: ${activeText};
        font-weight: 500;
      }
    `,
    active: css`
      font-weight: 500;
      background-color: ${activeBg};
      color: ${activeText};
      border-color: ${theme.colors.blueBase};
      /*To priorotize blue overlapping border*/
      z-index: 900;
    `,
    focus: css`
      &:focus {
        outline: none;
        z-index: 900;
        font-weight: 500;
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
    middle: css`
      border-radius: 0;
    `,
    first: css`
      border-radius: ${borderRadius}px 0 0 ${borderRadius}px;
      margin-left: 0;
    `,
    last: css`
      border-radius: 0 ${borderRadius}px ${borderRadius}px 0;
    `,
  };
};

interface ToggleButtonProps {
  onChange?: (value: any) => void;
  selected: boolean;
  value?: any;
  className?: string;
  children: ReactNode;
  tooltip?: string;
  key?: any;
  untouched?: boolean;
}

// export const ToggleButton: FC<ToggleButtonProps> = ({
//   children,
//   selected,
//   className = '',
//   value = null,
//   tooltip,
//   onChange,
//   // To toggle focus styles if the button has been pressed

//   untouched = false,
// }) => {
//   const theme = useContext(ThemeContext);
//   const styles = getStyles(theme);
//   const [select, setSelect] = useState(selected);
//   const activeStyle = select ? styles.active : null;

//   const onClick = (event: React.SyntheticEvent) => {
//     console.log(untouched);

//     untouched = false;
//     event.stopPropagation();
//     setSelect(!select);

//     if (onChange) {
//       onChange(value);
//     }
//   };

//   const handleBlur = () => {
//     console.log('Blurred');
//     untouched = true;
//   };

//   const button = (
//     <button
//       onBlur={handleBlur}
//       className={cx([styles.button, activeStyle, className, untouched ? styles.focus : styles.unFocused])}
//       onClick={onClick}
//     >
//       <span>{children}</span>
//     </button>
//   );

//   if (tooltip) {
//     return (
//       <Tooltip content={tooltip} placement="bottom">
//         {button}
//       </Tooltip>
//     );
//   } else {
//     return button;
//   }
// };

interface ToggleButtonState {
  untouched: boolean;
  selected: boolean;
  value?: any;
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
    console.log(e);
    this.setState({
      untouched: false,
      selected: !this.state.selected,
    });
    if (this.props.onChange) {
      this.props.onChange(this.state);
    }
  }

  handleBlur() {
    this.setState({
      untouched: true,
    });
  }

  renderButton(theme: GrafanaTheme) {
    const styles = getStyles(theme);
    const { children, className } = this.props;
    const activeStyle = this.state.selected || this.state.selected ? styles.active : null;

    return (
      <button
        onBlur={this.handleBlur}
        className={cx([styles.button, activeStyle, className, this.state.untouched ? styles.focus : styles.unFocused])}
        onClick={this.handleClick}
      >
        <span>{children}</span>
      </button>
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

function increaseContrast(color: any, amount: number): string {
  if (tinycolor(color).isLight()) {
    return tinycolor(color)
      .brighten(amount)
      .toString();
  }
  return tinycolor(color)
    .darken(amount)
    .toString();
}
