import { useLayoutEffect, useRef } from 'react';

import { useTheme2 } from '@grafana/ui';
import {
  isQueryCoauthoringEditorHost,
  type QueryCoauthoringEditorHost,
} from 'app/features/dashboard-scene/panel-edit/PanelEditNext/QueryEditor/coauthoring/queryCoauthoringContracts';

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
    notify.current = changed;
    const typed = () => {
      input.style.backgroundImage = '';
      changed();
    };
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
      showChanges(changes) {
        const ranges =
          changes?.flatMap((change) =>
            input.value === change.proposed ? change.proposedRanges : change.originalRanges
          ) ?? [];
        const lines = new Set<number>();
        for (const range of ranges) {
          const from = input.value.slice(0, range.from).split('\n').length - 1;
          const to = input.value.slice(0, Math.max(range.from, range.to - 1)).split('\n').length - 1;
          for (let line = from; line <= to; line++) {
            lines.add(line);
          }
        }
        const computed = getComputedStyle(input);
        const lineHeight = Number.parseFloat(computed.lineHeight) || 26;
        const top = Number.parseFloat(computed.paddingTop) || 0;
        input.style.backgroundImage = [...lines]
          .map(
            (line) =>
              `linear-gradient(to bottom, transparent ${top + line * lineHeight}px, ${theme.colors.success.transparent} ${top + line * lineHeight}px, ${theme.colors.success.transparent} ${top + (line + 1) * lineHeight}px, transparent ${top + (line + 1) * lineHeight}px)`
          )
          .join(',');
        input.style.backgroundAttachment = 'local';
      },
    });
    input.addEventListener('select', changed);
    input.addEventListener('keyup', changed);
    input.addEventListener('mouseup', changed);
    input.addEventListener('input', typed);
    input.addEventListener('keydown', shortcut);
    return () => {
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
