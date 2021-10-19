import type { EditorProps } from '@monaco-editor/react';

// we do not allow customizing the theme.
// (theme is complicated in Monaco, right now there is
// a limitation where all monaco editors must have
// the same theme, see
// https://github.com/microsoft/monaco-editor/issues/338#issuecomment-274837186
// )
export type Props = Omit<EditorProps, 'theme'>;
