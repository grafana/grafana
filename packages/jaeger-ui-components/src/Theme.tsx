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

import React from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';
import memoizeOne from 'memoize-one';

export type ThemeOptions = Partial<Theme>;

export type Theme = {
  borderStyle: string;
};

export const defaultTheme: Theme = {
  borderStyle: '1px solid #bbb',
};

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
        const mergedTheme: Theme = value
          ? {
              ...defaultTheme,
              ...value,
            }
          : defaultTheme;
        return props.children(mergedTheme);
      }}
    </ThemeContext.Consumer>
  );
}

type WrappedWithThemeComponent<Props> = React.ComponentType<Omit<Props, 'theme'>> & {
  wrapped: React.ComponentType<Props>;
};

export const withTheme = <Props extends { theme: Theme }, Statics extends {} = {}>(
  Component: React.ComponentType<Props>
): WrappedWithThemeComponent<Props> => {
  let WithTheme: React.ComponentType<Omit<Props, 'theme'>> = props => {
    return (
      <ThemeConsumer>
        {(theme: Theme) => (
          <Component
            {...({
              ...props,
              theme,
            } as Props & { theme: Theme })}
          />
        )}
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

export const createStyle = <Fn extends (this: any, ...newArgs: any[]) => ReturnType<Fn>>(fn: Fn) => {
  return memoizeOne(fn);
};
