import { css } from '@emotion/css';
import type * as monacoNS from 'monaco-editor';
import { useCallback, useEffect, useRef } from 'react';

import { colorManipulator } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useTheme2, type monacoTypes } from '@grafana/ui';

import { offsetsToRange } from '../editorRange';
import { getNodeAccentColor } from '../model/nodeColors';
import { type QueryFlowNode } from '../model/types';

type MonacoModule = typeof monacoNS;
type MonacoEditor = monacoTypes.editor.ICodeEditor;

/**
 * Locates this query row's editor by DOM containment rather than by matching model text: the row
 * header carries a `refId`-scoped test id, so we can find its row container and pick whichever
 * mounted Monaco editor's DOM node lives inside it. This avoids the ambiguity of text matching when
 * two rows share an identical expression, or the model hasn't caught up with a fresh keystroke yet.
 */
function findEditorByRefId(monaco: MonacoModule, refId: string): MonacoEditor | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const titleEl = document.querySelector(`[data-testid="${selectors.components.QueryEditorRow.title(refId)}"]`);
  const rowEl = titleEl?.closest(`[data-testid="${selectors.components.QueryEditorRows.rows}"]`);
  if (!rowEl) {
    return undefined;
  }
  return monaco.editor.getEditors().find((candidate) => {
    const dom = candidate.getDomNode();
    return dom ? rowEl.contains(dom) : false;
  });
}

// `monaco-editor` is a shared singleton module (also imported by the datasource query fields),
// so this dynamic import resolves to the already-loaded instance and its live editor registry.
let monacoPromise: Promise<MonacoModule> | null = null;
function loadMonaco(): Promise<MonacoModule> {
  if (!monacoPromise) {
    monacoPromise = import('monaco-editor');
  }
  return monacoPromise;
}

// Monaco decorations style spans via a CSS class name (emotion classes are injected globally, so
// they resolve inside the editor). Cache one class per resolved color/radius to avoid re-injecting.
const classCache = new Map<string, string>();
function highlightClass(color: string, borderRadius: string): string {
  const key = `${color}:${borderRadius}`;
  let cls = classCache.get(key);
  if (!cls) {
    cls = css({
      backgroundColor: colorManipulator.alpha(color, 0.25),
      borderRadius,
    });
    classCache.set(key, cls);
  }
  return cls;
}

/**
 * Returns a `highlight(node)` callback that decorates the substring a node represents inside the
 * datasource's Monaco query editor, using the node's accent color. Call with `undefined` to clear.
 *
 * The editor instance isn't exposed by the datasource plugins, so it's located by DOM containment
 * within this query row (see `findEditorByRefId`), falling back to matching the editor model's text
 * against `expr` if the row container can't be found (e.g. a datasource that doesn't use Monaco, or
 * markup that changed).
 */
export function useEditorHighlight({ expr, refId }: { expr: string; refId: string }): (node?: QueryFlowNode) => void {
  const theme = useTheme2();
  const collectionRef = useRef<monacoTypes.editor.IEditorDecorationsCollection | null>(null);
  // Monotonic token so a stale async apply (resolved after a newer hover/clear) is ignored.
  const requestRef = useRef(0);
  const exprRef = useRef(expr);
  exprRef.current = expr;
  const refIdRef = useRef(refId);
  refIdRef.current = refId;

  const clear = useCallback(() => {
    collectionRef.current?.clear();
    collectionRef.current = null;
  }, []);

  const highlight = useCallback(
    (node?: QueryFlowNode) => {
      const request = ++requestRef.current;
      clear();
      if (!node || !exprRef.current) {
        return;
      }
      loadMonaco().then((monaco) => {
        const currentExpr = exprRef.current;
        // Bail if a newer hover/clear happened, the query changed, or the query emptied out.
        if (request !== requestRef.current || !currentExpr) {
          return;
        }
        const editor =
          findEditorByRefId(monaco, refIdRef.current) ??
          monaco.editor.getEditors().find((candidate) => candidate.getModel()?.getValue() === currentExpr);
        const model = editor?.getModel();
        if (!editor || !model) {
          return;
        }
        const range = offsetsToRange(currentExpr, node.span.from, node.span.to);
        const inlineClassName = highlightClass(getNodeAccentColor(theme, node.kind), theme.shape.radius.default);
        collectionRef.current = editor.createDecorationsCollection([{ range, options: { inlineClassName } }]);
      });
    },
    [clear, theme]
  );

  // Drop any highlight when the query changes or the panel unmounts.
  useEffect(() => {
    return () => clear();
  }, [expr, clear]);

  return highlight;
}
