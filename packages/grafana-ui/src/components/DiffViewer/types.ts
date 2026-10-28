import { type CodeMirrorEditorLanguage } from '../CodeMirror/types';

export interface DiffViewerProps {
  original: string;
  modified: string;
  language?: CodeMirrorEditorLanguage;
  /** Viewer height, such as `'200px'` or `'100%'`. */
  height?: string;
  /** Leave undefined to show the mode toggle and use the persisted preference. */
  inline?: boolean;
  /** Show line numbers. Defaults to true. */
  lineNumbers?: boolean;
}
