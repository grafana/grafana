import type {} from 'slate-react';

declare module 'slate-react' {
  interface BasicEditorProps<T> {
    'aria-labelledby'?: string;
  }
}
