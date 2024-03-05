export default interface RootObject {
  color: Color;
  shadow: Shadow;
}
interface Shadow {
  z1: string;
  z2: string;
  z3: string;
}
interface Color {
  background: Background;
  text: Text;
  border: Border;
}
interface Border {
  weak: string;
  medium: string;
  strong: string;
}
interface Text {
  primary: string;
  secondary: string;
  disabled: string;
  link: string;
  maxContrast: string;
  maxContrastInverted: string;
}
interface Background {
  canvas: string;
  primary: string;
  secondary: string;
}
