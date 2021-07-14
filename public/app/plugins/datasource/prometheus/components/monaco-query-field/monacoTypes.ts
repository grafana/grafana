// we use "import type", so we will not bundle the monaco-editor with the code
import type * as monaco from 'monaco-editor';
type Monaco = typeof monaco;

export { monaco, Monaco };
