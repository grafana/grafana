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

export type TooltipPlacement =
  | 'top'
  | 'left'
  | 'right'
  | 'bottom'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | 'leftTop'
  | 'leftBottom'
  | 'rightTop'
  | 'rightBottom';
export type PopoverProps = {
  content?: React.ReactNode;
  arrowPointAtCenter?: boolean;
  overlayClassName?: string;
  placement?: TooltipPlacement;
  children?: React.ReactNode;
};

export const UIPopover: React.ComponentType<PopoverProps> = function UIPopover(props: PopoverProps) {
  return (
    <GetElementsContext>
      {(elements: Elements) => {
        return <elements.Popover {...props} />;
      }}
    </GetElementsContext>
  );
};

type RenderFunction = () => React.ReactNode;
export type TooltipProps = {
  title?: React.ReactNode | RenderFunction;
  getPopupContainer?: (triggerNode: Element) => HTMLElement;
  overlayClassName?: string;
  children?: React.ReactNode;
  placement?: TooltipPlacement;
  mouseLeaveDelay?: number;
  arrowPointAtCenter?: boolean;
  onVisibleChange?: (visible: boolean) => void;
};

export const UITooltip: React.ComponentType<TooltipProps> = function UITooltip(props: TooltipProps) {
  return (
    <GetElementsContext>
      {(elements: Elements) => {
        return <elements.Tooltip {...props} />;
      }}
    </GetElementsContext>
  );
};

export type IconProps = {
  type: string;
  className?: string;
  onClick?: React.MouseEventHandler<any>;
};

export const UIIcon: React.ComponentType<IconProps> = function UIIcon(props: IconProps) {
  return (
    <GetElementsContext>
      {(elements: Elements) => {
        return <elements.Icon {...props} />;
      }}
    </GetElementsContext>
  );
};

export type DropdownProps = {
  overlay: React.ReactNode;
  placement?: 'topLeft' | 'topCenter' | 'topRight' | 'bottomLeft' | 'bottomCenter' | 'bottomRight';
  trigger?: Array<'click' | 'hover' | 'contextMenu'>;
  children?: React.ReactNode;
};

export const UIDropdown = function UIDropdown(props: DropdownProps) {
  return (
    <GetElementsContext>
      {(elements: Elements) => {
        return <elements.Dropdown {...props} />;
      }}
    </GetElementsContext>
  );
};

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

export type ButtonHTMLType = 'submit' | 'button' | 'reset';
export type ButtonProps = {
  children?: React.ReactNode;
  className?: string;
  htmlType?: ButtonHTMLType;
  icon?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

export const UIButton = function UIButton(props: ButtonProps) {
  return (
    <GetElementsContext>
      {(elements: Elements) => {
        return <elements.Button {...props} />;
      }}
    </GetElementsContext>
  );
};

export type DividerProps = {
  className?: string;
  type?: 'vertical' | 'horizontal';
};

export const UIDivider = function UIDivider(props: DividerProps) {
  return (
    <GetElementsContext>
      {(elements: Elements) => {
        return <elements.Divider {...props} />;
      }}
    </GetElementsContext>
  );
};

export type InputProps = {
  autosize?: boolean | null;
  placeholder?: string;
  onChange: (value: React.ChangeEvent<HTMLInputElement>) => void;
  suffix: React.ReactNode;
  value?: string;
};

export const UIInput: React.FC<InputProps> = function UIInput(props: InputProps) {
  return (
    <GetElementsContext>
      {(elements: Elements) => {
        return <elements.Input {...props} />;
      }}
    </GetElementsContext>
  );
};

export type InputGroupProps = {
  className?: string;
  compact?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export const UIInputGroup = function UIInputGroup(props: InputGroupProps) {
  return (
    <GetElementsContext>
      {(elements: Elements) => {
        return <elements.InputGroup {...props} />;
      }}
    </GetElementsContext>
  );
};

export type Elements = {
  Popover: React.ComponentType<PopoverProps>;
  Tooltip: React.ComponentType<TooltipProps>;
  Icon: React.ComponentType<IconProps>;
  Dropdown: React.ComponentType<DropdownProps>;
  Menu: React.ComponentType<MenuProps>;
  MenuItem: React.ComponentType<MenuItemProps>;
  Button: React.ComponentType<ButtonProps>;
  Divider: React.ComponentType<DividerProps>;
  Input: React.ComponentType<InputProps>;
  InputGroup: React.ComponentType<InputGroupProps>;
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
