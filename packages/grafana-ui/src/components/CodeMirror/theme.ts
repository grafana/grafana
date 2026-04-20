import { tags as t } from '@lezer/highlight';
import { createTheme, type CreateThemeOptions, type Settings } from '@uiw/codemirror-themes';
import { type Extension } from '@uiw/react-codemirror';

import { type GrafanaTheme2 } from '@grafana/data';

export const defaultSettingsBasicLight: Settings = {
  background: '#ffffff',
  foreground: '#2e3440',
  caret: '#3b4252',
  selection: '#eceff4',
  selectionMatch: '#e5e9f0',
  gutterBackground: '#eceff4',
  gutterForeground: '#2e3440',
  gutterBorder: 'none',
  lineHighlight: '#02255f11',
};

export const basicLightStyle: CreateThemeOptions['styles'] = [
  { tag: t.keyword, color: '#5e81ac' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#d08770' },
  { tag: [t.variableName], color: '#d08770' },
  { tag: [t.function(t.variableName)], color: '#5e81ac' },
  { tag: [t.labelName], color: '#81a1c1' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#5e81ac' },
  { tag: [t.definition(t.name), t.separator], color: '#a3be8c' },
  { tag: [t.brace], color: '#8fbcbb' },
  { tag: [t.annotation], color: '#d30102' },
  { tag: [t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#88c0d0' },
  { tag: [t.typeName, t.className], color: '#ebcb8b' },
  { tag: [t.operator, t.operatorKeyword], color: '#a3be8c' },
  { tag: [t.tagName], color: '#b48ead' },
  { tag: [t.squareBracket], color: '#bf616a' },
  { tag: [t.angleBracket], color: '#d08770' },
  { tag: [t.attributeName], color: '#ebcb8b' },
  { tag: [t.regexp], color: '#5e81ac' },
  { tag: [t.quote], color: '#3b4252' },
  { tag: [t.string], color: '#d08770' },
  {
    tag: t.link,
    color: '#8fbcbb',
    textDecoration: 'underline',
    textUnderlinePosition: 'under',
  },
  { tag: [t.url, t.escape, t.special(t.string)], color: '#d08770' },
  { tag: [t.meta], color: '#88c0d0' },
  { tag: [t.comment], color: '#434c5e', fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold', color: '#5e81ac' },
  { tag: t.emphasis, fontStyle: 'italic', color: '#5e81ac' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.heading, fontWeight: 'bold', color: '#5e81ac' },
  { tag: t.special(t.heading1), fontWeight: 'bold', color: '#5e81ac' },
  { tag: t.heading1, fontWeight: 'bold', color: '#5e81ac' },
  {
    tag: [t.heading2, t.heading3, t.heading4],
    fontWeight: 'bold',
    color: '#5e81ac',
  },
  {
    tag: [t.heading5, t.heading6],
    color: '#5e81ac',
  },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#d08770' },
  {
    tag: [t.processingInstruction, t.inserted],
    color: '#8fbcbb',
  },
  { tag: [t.contentSeparator], color: '#ebcb8b' },
  { tag: t.invalid, color: '#434c5e', borderBottom: '1px dotted #d30102' },
];

export const defaultSettingsBasicDark: Settings = {
  background: '#181b1f',
  foreground: '#DDDDDD',
  caret: '#DDDDDD',
  selection: '#202325',
  selectionMatch: '#202325',
  gutterBackground: '#292d30',
  gutterForeground: '#808080',
  gutterBorder: '1px solid #ffffff10',
  lineHighlight: '#B9D2FF30',
};

export const basicDarkStyle: CreateThemeOptions['styles'] = [
  { tag: t.keyword, color: '#fda331' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#b5bd68' },
  { tag: [t.variableName], color: '#6fb3d2' },
  { tag: [t.function(t.variableName)], color: '#fda331' },
  { tag: [t.labelName], color: '#fc6d24' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#fda331' },
  { tag: [t.definition(t.name), t.separator], color: '#cc99cc' },
  { tag: [t.brace], color: '#cc99cc' },
  { tag: [t.annotation], color: '#fc6d24' },
  { tag: [t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#fda331' },
  { tag: [t.typeName, t.className], color: '#6fb3d2' },
  { tag: [t.operator, t.operatorKeyword], color: '#cc99cc' },
  { tag: [t.tagName], color: '#fda331' },
  { tag: [t.squareBracket], color: '#cc99cc' },
  { tag: [t.angleBracket], color: '#cc99cc' },
  { tag: [t.attributeName], color: '#6fb3d2' },
  { tag: [t.regexp], color: '#fda331' },
  { tag: [t.quote], color: '#DDDDDD' },
  { tag: [t.string], color: '#b5bd68' },
  {
    tag: t.link,
    color: '#6987AF',
    textDecoration: 'underline',
    textUnderlinePosition: 'under',
  },
  { tag: [t.url, t.escape, t.special(t.string)], color: '#8abeb7' },
  { tag: [t.meta], color: '#A54543' },
  { tag: [t.comment], color: '#808080', fontStyle: 'italic' },
  { tag: t.monospace, color: '#DDDDDD' },
  { tag: t.strong, fontWeight: 'bold', color: '#fda331' },
  { tag: t.emphasis, fontStyle: 'italic', color: '#6fb3d2' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.heading, fontWeight: 'bold', color: '#DDDDDD' },
  { tag: t.special(t.heading1), fontWeight: 'bold', color: '#DDDDDD' },
  { tag: t.heading1, fontWeight: 'bold', color: '#DDDDDD' },
  {
    tag: [t.heading2, t.heading3, t.heading4],
    fontWeight: 'bold',
    color: '#DDDDDD',
  },
  { tag: [t.heading5, t.heading6], color: '#DDDDDD' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#8abeb7' },
  { tag: [t.processingInstruction, t.inserted], color: '#8abeb7' },
  { tag: [t.contentSeparator], color: '#6fb3d2' },
  { tag: t.invalid, color: '#B9D2FF', borderBottom: '1px dotted #fc6d24' },
];

const basicLightInit = (theme: GrafanaTheme2, options?: Partial<CreateThemeOptions>) => {
  const { theme: mode = 'light', settings = {}, styles = [] } = options || {};
  void theme;

  return createTheme({
    theme: mode,
    settings: {
      ...defaultSettingsBasicLight,
      ...settings,
    },
    // Keep the Grafana theme object available here so colors can move
    // to Grafana tokens incrementally without reshaping this file.
    styles: [...basicLightStyle, ...styles],
  });
};

const basicDarkInit = (theme: GrafanaTheme2, options?: Partial<CreateThemeOptions>) => {
  const { theme: mode = 'dark', settings = {}, styles = [] } = options || {};
  void theme;

  return createTheme({
    theme: mode,
    settings: {
      ...defaultSettingsBasicDark,
      ...settings,
    },
    // Keep the Grafana theme object available here so colors can move
    // to Grafana tokens incrementally without reshaping this file.
    styles: [...basicDarkStyle, ...styles],
  });
};

export const getCodeEditorTheme = (theme: GrafanaTheme2): Extension =>
  theme.isDark ? basicDarkInit(theme) : basicLightInit(theme);
