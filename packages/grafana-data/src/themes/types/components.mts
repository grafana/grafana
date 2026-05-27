import { type Radii } from './shape.mts';
import { type ThemeSpacingTokens } from './spacing.mts';

export interface MenuComponentTokens {
  borderRadius: keyof Radii;
  padding: ThemeSpacingTokens;
}

/** @beta */
export interface ThemeComponents {
  /** Applies to normal buttons, inputs, radio buttons, etc */
  height: {
    sm: number;
    md: number;
    lg: number;
  };
  input: {
    background: string;
    borderColor: string;
    borderHover: string;
    text: string;
  };
  tooltip: {
    text: string;
    background: string;
  };
  panel: {
    padding: number;
    headerHeight: number;
    borderColor: string;
    boxShadow: string;
    background: string;
  };
  dropdown: {
    background: string;
  };
  overlay: {
    background: string;
  };
  dashboard: {
    background: string;
    padding: number;
  };
  drawer: {
    padding: number;
  };
  textHighlight: {
    background: string;
    text: string;
  };
  sidemenu: {
    width: number;
  };
  horizontalDrawer: {
    defaultHeight: number;
  };
  table: {
    rowHoverBackground: string;
    rowSelected: string;
  };
  menu: MenuComponentTokens;
}
