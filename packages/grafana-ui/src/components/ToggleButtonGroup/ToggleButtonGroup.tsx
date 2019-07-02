import React, { ReactNode, PureComponent, useContext, FC } from 'react';
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

interface ToggleButtonProps {
  onChange?: (value: any) => void;
  selected?: boolean;
  value: any;
  className?: string;
  children: ReactNode;
  tooltip?: string;
  key?: any;
}

const getStyles = (theme: GrafanaTheme) => {
  const borderRadius = 3;

  return {
    button: css`
      border: solid 2px #3274d9;
      color: ${theme.colors.text};
      padding: 0 16px;
      background-color: ${theme.background.toggleButton.default};
      border-radius: ${borderRadius}px;
      height: 36px;
      font-size: 14px;
      font-weight: regular;
      &:hover {
        color: ${theme.colors.activeColor};
      }
    `,
    active: css`
      font-weight: medium;
    `,
    middle: css`
      border-radius: 0;
      border-left: none;
    `,
    first: css`
      border-radius: ${borderRadius}px 0 0 ${borderRadius}px;
    `,
    last: css`
      border-radius: 0 ${borderRadius}px ${borderRadius}px 0;
      border-left: none;
    `,
  };
};

export const ToggleButton: FC<ToggleButtonProps> = ({
  children,
  selected,
  className = '',
  value = null,
  tooltip,
  onChange,
}) => {
  // const activeStyles: any = {
  //   fontWeight: 'medium',
  // };

  const theme = useContext(ThemeContext);

  const onClick = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    if (!selected && onChange) {
      onChange(value);
    }
  };

  // const btnClassName = `btn ${className} ${selected ? 'active' : ''}`;

  const button = (
    <button className={cx([getStyles(theme).button, className])} onClick={onClick}>
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
