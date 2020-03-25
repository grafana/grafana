import React, { PureComponent, ComponentType, HTMLAttributes } from 'react';
import { css, cx } from 'emotion';
import { camelCase } from 'lodash';

import { stylesFactory, withTheme } from '../../themes';
import { Themeable } from '../../types';
import { IconType } from './types';
import { ComponentSize } from '../../types/size';

interface IconProps extends Themeable, HTMLAttributes<HTMLElement> {
  name: IconType;
  size?: ComponentSize;
  color?: string;
  type?: 'default' | 'mono';
}
export type SvgProps = {
  size: number;
  color: string;
  secondaryColor?: string;
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

  pascalCase(str: string) {
    const string = camelCase(str);
    return string.charAt(0).toUpperCase() + string.substring(1);
  }

  componentDidMount() {
    const { name, type = 'default' } = this.props;
    if (type === 'default') {
      import(`@iconscout/react-unicons/icons/uil-${name}`).then(module => {
        this.setState({ icon: module.default });
      });
    }
    if (type === 'mono') {
      const monoIconName = this.pascalCase(name);
      import(`./assets/${monoIconName}`).then(module => {
        this.setState({ icon: module.default });
      });
    }
  }

  render() {
    const { type = 'default', size = 'md', color, className, theme, ...rest } = this.props;
    const { icon: Component } = this.state;

    const styles = getIconStyles();
    const mainColor = color || theme.colors.orange;
    const secondaryColor = `${mainColor}99`;

    /*Transform string with px to number*/
    const svgSize = Number(theme.typography.size[size].slice(0, -2));

    return (
      <div
        className={cx(styles.icon, { [styles.currentFontColor]: !color && type === 'default' }, className)}
        {...rest}
      >
        {Component && <Component color={mainColor} secondaryColor={secondaryColor} size={svgSize} />}
      </div>
    );
  }
}

export const Icon = withTheme(UnThemedIcon);
