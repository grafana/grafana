export interface RootObject {
  color: Color;
  shadow: Shadow;
}
export interface Color {
  background: Background;
  border: Border;
  content: Content;
  shadow: Shadow;
}
export interface Shadow {
  z1: string;
  z2: string;
  z3: string;
}
export interface Content {
  primary: string;
  secondary: string;
  disabled: string;
  link: string;
  system: System2;
}
export interface System2 {
  success: Success;
  warning: Success;
  error: Success;
  info: Success;
}
export interface Success {
  heading: string;
  body: string;
}
export interface Border {
  ui: Ui2;
  system: System;
}
export interface Ui2 {
  weak: string;
  medium: string;
  strong: string;
  divider: string;
}
export interface Background {
  ui: Ui;
  system: System;
}
export interface System {
  success: string;
  warning: string;
  error: string;
  info: string;
}
export interface Ui {
  canvas: string;
  primary: string;
  secondary: string;
  tertiary: string;
  overlay: string;
}
