import { type CellContentKind } from '@grafana/schema/apis/notebook/v2beta1';
import { CodeEditor } from '@grafana/ui';

const LINE_HEIGHT = 18;
const MIN_LINES = 3;
const MAX_LINES = 30;

// Monaco needs an explicit height; approximate it from the line count so short
// snippets stay compact and long ones cap out with an internal scroll.
export function CodeCell({ content }: { content: CellContentKind }) {
  if (content.kind !== 'Code') {
    return null;
  }

  const lines = content.spec.code.split('\n').length;
  const height = Math.min(Math.max(lines, MIN_LINES), MAX_LINES) * LINE_HEIGHT;

  return (
    <CodeEditor
      value={content.spec.code}
      language={content.spec.language}
      height={height}
      width="100%"
      readOnly
      showLineNumbers
    />
  );
}
