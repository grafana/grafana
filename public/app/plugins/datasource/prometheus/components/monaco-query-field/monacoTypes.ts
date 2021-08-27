// we use "import type", so we will not bundle the monaco-editor with the code
import type Monaco from 'monaco-editor';
type MonacoTypeof = typeof Monaco;

export { Monaco as monaco, MonacoTypeof as Monaco };
