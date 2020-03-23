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
      vertical-align: middle;
    `,
    iconSvg: css`
      svg {
        fill: currentColor;
      }
    `,
  };
});

export interface IconState {
  module: null | ComponentType<{ color?: string; size?: number }>;
}

class UnThemedUnicon extends PureComponent<IconProps, IconState> {
  constructor(props: IconProps) {
    super(props);
    this.state = {
      module: null,
    };
  }

  componentDidMount() {
    const { name, type } = this.props;
    if (type === 'icon') {
      import(`@iconscout/react-unicons/icons/uil-${name}`).then(module => this.setState({ module: module.default }));
    }
  }

  render() {
    const { color, size, theme } = this.props;
    const { module: Component } = this.state;

    /*Transform string with px to number*/
    const svgSize = Number(theme.typography.size[size || 'base'].slice(0, -2));
    const styles = getIconStyles();

    return (
      <div className={cx(styles.icon, { [styles.iconSvg]: !color })}>
        {Component && <Component color={color} size={svgSize} />}
      </div>
    );
  }
}

export const Unicon = withTheme(UnThemedUnicon);
