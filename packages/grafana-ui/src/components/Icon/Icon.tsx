import React, { PureComponent, ComponentType } from 'react';
import { css, cx } from 'emotion';

import { stylesFactory, withTheme } from '../../themes';
import { Themeable } from '../../types';
import { IconType } from './types';

type Size = 'xs' | 'sm' | 'base' | 'md' | 'lg';

interface IconProps extends Themeable {
  name: IconType;
  size?: Size;
  color?: string;
  type?: 'icon' | 'monochrome';
  title?: string;
  onClick?: () => void;
  onMouseDown?: React.MouseEventHandler;
}

const getIconStyles = stylesFactory(() => {
  return {
    icon: css`
      display: inline-block;
      * {
        vertical-align: middle;
      }
    `,
    iconSvg: css`
      svg {
        fill: currentColor;
      }
    `,
  };
});

export interface IconState {
  icon: null | ComponentType<{ color?: string; size?: number }>;
}

class UnThemedIcon extends PureComponent<IconProps, IconState> {
  constructor(props: IconProps) {
    super(props);
    this.state = {
      icon: null,
    };
  }

  componentDidMount() {
    const { name, type = 'icon' } = this.props;
    if (type === 'icon') {
      import(`@iconscout/react-unicons/icons/uil-${name}`).then(module => {
        this.setState({ icon: module.default });
      });
    }
    if (type === 'monochrome') {
      import(`./assets/${name}`).then(module => {
        this.setState({ icon: module.default });
      });
    }
  }

  render() {
    const { color, size, theme, type = 'icon' } = this.props;
    const { icon: Component } = this.state;

    /*Transform string with px to number*/
    const svgSize = Number(theme.typography.size[size || 'base'].slice(0, -2));
    const defaultMonochromeColor = theme.colors.orange;
    console.log(defaultMonochromeColor);
    const styles = getIconStyles();

    return (
      <div className={cx(styles.icon, { [styles.iconSvg]: !color && type === 'icon' })}>
        {Component && <Component color={color ? color : defaultMonochromeColor} size={svgSize} />}
      </div>
    );
  }
}

export const Icon = withTheme(UnThemedIcon);
