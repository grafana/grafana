import React, { ReactNode, PureComponent, useContext, FC, useState } from 'react';
import { Tooltip } from '../Tooltip/Tooltip';
import { ThemeContext } from '../../themes/index';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '../../types/theme';

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
  const borderRadius = 3;

  return {
    button: css`
      border: solid 1px #c7d0d9;
      color: ${theme.colors.text};
      padding: 0 16px;
      background-color: ${theme.background.toggleButton.default};
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
        color: ${theme.colors.activeColor};
        font-weight: 500;
      }
      &:focus {
        outline: none;
        z-index: 900;
        font-weight: 500;
        color: ${theme.colors.activeColor};
        border-color: ${theme.colors.blueBase};
      }
    `,
    active: css`
      font-weight: 500;
      background-color: ${theme.background.toggleButton.active};
      border-color: ${theme.colors.blueBase};
      /*To priorotize blue overlapping border*/
      z-index: 900;
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
}

export const ToggleButton: FC<ToggleButtonProps> = ({
  children,
  selected,
  className = '',
  value = null,
  tooltip,
  onChange,
}) => {
  const theme = useContext(ThemeContext);
  const styles = getStyles(theme);
  const [select, setSelect] = useState(selected);
  const activeStyle = select ? styles.active : null;

  const onClick = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    setSelect(!select);
    if (onChange) {
      onChange(value);
    }
  };

  const button = (
    <button className={cx([styles.button, activeStyle, className])} onClick={onClick}>
      <span>{children}</span>
    </button>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} placement="bottom">
        {button}
      </Tooltip>
    );
  } else {
    return button;
  }
};
