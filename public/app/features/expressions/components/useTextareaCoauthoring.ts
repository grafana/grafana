import { useLayoutEffect, useRef } from 'react';

import { useTheme2 } from '@grafana/ui';
import {
  isQueryCoauthoringEditorHost,
  type QueryCoauthoringEditorHost,
  type QueryCoauthoringTextChange,
} from 'app/features/dashboard-scene/panel-edit/PanelEditNext/QueryEditor/coauthoring/queryCoauthoringContracts';

function getVisualRows(
  input: HTMLTextAreaElement,
  ranges: ReadonlyArray<{ from: number; to: number }>,
  computed: CSSStyleDeclaration,
  lineHeight: number
) {
  if (!input.value) {
    return new Set([0]);
  }
  // Native textareas do not expose their layout boxes. Measure the same text and wrapping in a hidden mirror.
  const mirror = input.ownerDocument.createElement('div');
  Object.assign(mirror.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    width: `${Math.max(0, input.clientWidth - (Number.parseFloat(computed.paddingLeft) || 0) - (Number.parseFloat(computed.paddingRight) || 0))}px`,
    font: computed.font,
    lineHeight: `${lineHeight}px`,
    letterSpacing: computed.letterSpacing,
    wordSpacing: computed.wordSpacing,
    whiteSpace: computed.whiteSpace,
    overflowWrap: computed.overflowWrap,
    wordBreak: computed.wordBreak,
    tabSize: computed.tabSize,
    direction: computed.direction,
  });
  const text = input.ownerDocument.createTextNode(input.value);
  mirror.append(text);
  input.ownerDocument.body.append(mirror);
  try {
    const top = mirror.getBoundingClientRect().top;
    const range = input.ownerDocument.createRange();
    const rows = new Set<number>();
    for (const { from, to } of ranges) {
      const start = Math.min(input.value.length, Math.max(0, from));
      const end = Math.min(input.value.length, Math.max(start, to));
      range.setStart(text, start);
      range.setEnd(text, end);
      for (const rect of range.getClientRects()) {
        rows.add(Math.floor((rect.top + rect.height / 2 - top) / lineHeight));
      }
    }
    return rows;
  } finally {
    mirror.remove();
  }
}

export function useTextareaCoauthoring(host: QueryCoauthoringEditorHost | undefined, value: string | undefined) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const theme = useTheme2();
  const notify = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input || !isQueryCoauthoringEditorHost(host)) {
      return;
    }
    const backgroundImage = input.style.backgroundImage;
    const backgroundAttachment = input.style.backgroundAttachment;
    const listeners = new Set<() => void>();
    const changed = () => listeners.forEach((listener) => listener());
    let changes: QueryCoauthoringTextChange[] | null = null;
    let paintedWidth = input.clientWidth;
    const paint = () => {
      paintedWidth = input.clientWidth;
      const ranges =
        changes?.flatMap((change) => {
          if (input.value === change.proposed) {
            return change.proposedRanges;
          }
          return input.value === change.original ? change.originalRanges : [];
        }) ?? [];
      if (!ranges.length) {
        input.style.backgroundImage = backgroundImage;
        input.style.backgroundAttachment = backgroundAttachment;
        return;
      }
      const computed = getComputedStyle(input);
      const lineHeight = Number.parseFloat(computed.lineHeight) || 26;
      const top = Number.parseFloat(computed.paddingTop) || 0;
      input.style.backgroundImage = [...getVisualRows(input, ranges, computed, lineHeight)]
        .map((row) => {
          const start = top + row * lineHeight;
          const end = start + lineHeight;
          const color = theme.colors.success.transparent;
          return `linear-gradient(to bottom, transparent ${start}px, ${color} ${start}px, ${color} ${end}px, transparent ${end}px)`;
        })
        .join(',');
      input.style.backgroundAttachment = 'local';
    };
    notify.current = () => {
      if (changes) {
        paint();
      }
      changed();
    };
    const typed = () => {
      changes = null;
      paint();
      changed();
    };
    const resize = new ResizeObserver(() => {
      if (changes && input.clientWidth !== paintedWidth) {
        paint();
      }
    });
    resize.observe(input);
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === '.') {
        event.preventDefault();
        event.stopPropagation();
        host.invoke();
      }
    };
    const stop = host.register({
      version: 1,
      getSelection: () =>
        input.selectionStart === input.selectionEnd
          ? null
          : {
              ranges: [{ from: input.selectionStart, to: input.selectionEnd }],
              anchor: input,
            },
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      showChanges(next) {
        changes = next;
        paint();
      },
    });
    input.addEventListener('select', changed);
    input.addEventListener('keyup', changed);
    input.addEventListener('mouseup', changed);
    input.addEventListener('input', typed);
    input.addEventListener('keydown', shortcut);
    return () => {
      resize.disconnect();
      stop();
      listeners.clear();
      notify.current = () => {};
      input.style.backgroundImage = backgroundImage;
      input.style.backgroundAttachment = backgroundAttachment;
      input.removeEventListener('select', changed);
      input.removeEventListener('keyup', changed);
      input.removeEventListener('mouseup', changed);
      input.removeEventListener('input', typed);
      input.removeEventListener('keydown', shortcut);
    };
  }, [host, theme]);
  useLayoutEffect(() => {
    notify.current();
  }, [value]);
  return ref;
}
