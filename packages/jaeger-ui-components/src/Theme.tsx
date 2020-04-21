// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { useContext } from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';
import memoizeOne from 'memoize-one';
import tinycolor from 'tinycolor2';

export type ThemeOptions = Partial<Theme>;

export enum ThemeType {
  Dark,
  Light,
}

export type Theme = {
  type: ThemeType;
  borderStyle: string;
};

export const defaultTheme: Theme = {
  type: ThemeType.Light,
  borderStyle: '1px solid #bbb',
};

export function isLight(theme: Theme) {
  return theme.type === ThemeType.Light;
}

const ThemeContext = React.createContext<ThemeOptions | undefined>(undefined);
ThemeContext.displayName = 'ThemeContext';

export const ThemeProvider = ThemeContext.Provider;

type ThemeConsumerProps = {
  children: (theme: Theme) => React.ReactNode;
};
export function ThemeConsumer(props: ThemeConsumerProps) {
  return (
    <ThemeContext.Consumer>
      {(value: ThemeOptions | undefined) => {
        const theme = memoizedThemeMerge(value);
        return props.children(theme);
      }}
    </ThemeContext.Consumer>
  );
}

const memoizedThemeMerge = memoizeOne(value => {
  return value
    ? {
        ...defaultTheme,
        ...value,
      }
    : defaultTheme;
});

type WrappedWithThemeComponent<Props> = React.ComponentType<Omit<Props, 'theme'>> & {
  wrapped: React.ComponentType<Props>;
};

export const withTheme = <Props extends { theme: Theme }, Statics extends {} = {}>(
  Component: React.ComponentType<Props>
): WrappedWithThemeComponent<Props> => {
  let WithTheme: React.ComponentType<Omit<Props, 'theme'>> = props => {
    return (
      <ThemeConsumer>
        {(theme: Theme) => {
          return (
            <Component
              {...({
                ...props,
                theme,
              } as Props & { theme: Theme })}
            />
          );
        }}
      </ThemeConsumer>
    );
  };

  WithTheme.displayName = `WithTheme(${Component.displayName})`;
  WithTheme = hoistNonReactStatics<React.ComponentType<Omit<Props, 'theme'>>, React.ComponentType<Props>>(
    WithTheme,
    Component
  );
  (WithTheme as WrappedWithThemeComponent<Props>).wrapped = Component;
  return WithTheme as WrappedWithThemeComponent<Props>;
};

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  return {
    ...defaultTheme,
    ...theme,
  };
}

export const createStyle = <Fn extends (this: any, ...newArgs: any[]) => ReturnType<Fn>>(fn: Fn) => {
  return memoizeOne(fn);
};

/**
 * Tries to get a dark variant color. Either by simply inverting the luminosity and darkening or lightening the color
 * a bit, or if base is provided, tries 2 variants of lighter and darker colors and checks which is more readable with
 * the base.
 * @param theme
 * @param hex
 * @param base
 */
export function autoColor(theme: Theme, hex: string, base?: string) {
  if (isLight(theme)) {
    return hex;
  } else {
    if (base) {
      const color = tinycolor(hex);
      return tinycolor
        .mostReadable(
          base,
          [
            color.clone().lighten(25),
            color.clone().lighten(10),
            color,
            color.clone().darken(10),
            color.clone().darken(25),
          ],
          {
            includeFallbackColors: false,
          }
        )
        .toHex8String();
    }
    const color = tinycolor(hex).toHsl();
    color.l = 1 - color.l;
    const newColor = tinycolor(color);
    return newColor.isLight() ? newColor.darken(5).toHex8String() : newColor.lighten(5).toHex8String();
  }
}
