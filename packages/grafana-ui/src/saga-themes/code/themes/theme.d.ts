export default interface RootObject {
  color: Color;
  shadow: Shadow;
}
interface Color {
  background: Background;
  border: Border;
  content: Content;
  shadow: Shadow;
}
interface Shadow {
  z1: string;
  z2: string;
  z3: string;
}
interface Content {
  primary: string;
  secondary: string;
  disabled: string;
  link: string;
  system: System2;
}
interface System2 {
  success: Success;
  warning: Success;
  error: Success;
  info: Success;
}
interface Success {
  heading: string;
  body: string;
}
interface Border {
  ui: Ui2;
  system: System;
}
interface Ui2 {
  weak: string;
  medium: string;
  strong: string;
  divider: string;
}
interface Background {
  ui: Ui;
  system: System;
}
interface System {
  success: string;
  warning: string;
  error: string;
  info: string;
}
interface Ui {
  canvas: string;
  primary: string;
  secondary: string;
  tertiary: string;
  overlay: string;
}
