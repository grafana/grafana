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

export type MenuProps = {
  children?: React.ReactNode;
};

export const UIMenu = function UIMenu(props: MenuProps) {
  return (
    <GetElementsContext>
      {(elements: Elements) => {
        return <elements.Menu {...props} />;
      }}
    </GetElementsContext>
  );
};

export type MenuItemProps = {
  children?: React.ReactNode;
};

export const UIMenuItem = function UIMenuItem(props: MenuItemProps) {
  return (
    <GetElementsContext>
      {(elements: Elements) => {
        return <elements.MenuItem {...props} />;
      }}
    </GetElementsContext>
  );
};

export type Elements = {
  Menu: React.ComponentType<MenuProps>;
  MenuItem: React.ComponentType<MenuItemProps>;
};

/**
 * Allows for injecting custom UI elements that will be used. Mainly for styling and removing dependency on
 * any specific UI library but can also inject specific behaviour.
 */
const UIElementsContext = React.createContext<Elements | undefined>(undefined);
UIElementsContext.displayName = 'UIElementsContext';
export default UIElementsContext;

type GetElementsContextProps = {
  children: (elements: Elements) => React.ReactNode;
};

/**
 * Convenience render prop style component to handle error state when elements are not defined.
 */
export function GetElementsContext(props: GetElementsContextProps) {
  return (
    <UIElementsContext.Consumer>
      {(value: Elements | undefined) => {
        if (!value) {
          throw new Error('Elements context is required. You probably forget to use UIElementsContext.Provider');
        }
        return props.children(value);
      }}
    </UIElementsContext.Consumer>
  );
}
