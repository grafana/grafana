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
export type SvgProps = {
  size: number;
  color: string;
  backgroundColor?: string;
};

const getIconStyles = stylesFactory(() => {
  return {
    icon: css`
      display: inline-block;
      * {
        vertical-align: middle;
      }
    `,
    currentFontColor: css`
      svg {
        fill: currentColor;
      }
    `,
  };
});

export interface IconState {
  icon: null | ComponentType<SvgProps>;
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
      import('./assets/ExclamationTriangle').then(module => {
        this.setState({ icon: module.default });
      });
    }
  }

  render() {
    const { color, size, theme, title, onClick, onMouseDown, type = 'icon' } = this.props;
    const { icon: Component } = this.state;

    const styles = getIconStyles();
    const monochromeColor = color || theme.colors.orange;
    const backgroundColor = `${monochromeColor}99`;

    /*Transform string with px to number*/
    const svgSize = Number(theme.typography.size[size || 'base'].slice(0, -2));

    return (
      <div
        title={title}
        onClick={onClick}
        onMouseDown={onMouseDown}
        className={cx(styles.icon, { [styles.currentFontColor]: !color && type === 'icon' })}
      >
        {Component && (
          <Component color={color ? color : monochromeColor} backgroundColor={backgroundColor} size={svgSize} />
        )}
      </div>
    );
  }
}

export const Icon = withTheme(UnThemedIcon);
