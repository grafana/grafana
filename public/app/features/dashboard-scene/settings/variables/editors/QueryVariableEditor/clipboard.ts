import { useState, useEffect, useCallback, useMemo } from 'react';
import { firstValueFrom } from 'rxjs';

import { CustomVariable, type VariableValueOption, type VariableValueOptionProperties } from '@grafana/scenes';

export type ClipboardTextFormat = 'tsv' | 'json' | 'csv' | undefined;

export function detectClipboardTextFormat(text: string): ClipboardTextFormat {
  if (text.includes('\t')) {
    return 'tsv';
  }
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.every((o) => typeof o === 'object' && o !== null)) {
        return 'json';
      }
    } catch {
      // not valid JSON, fall through to csv or
    }
  }
  return text.includes(',') ? 'csv' : undefined;
}

export async function parseClipboardText(text: string, properties: string[]): Promise<VariableValueOption[]> {
  const format = detectClipboardTextFormat(text);

  switch (format) {
    case 'tsv':
      return parseTsv(text, properties);
    case 'csv':
    case 'json': {
      const draft = new CustomVariable({ query: text, valuesFormat: format });
      return firstValueFrom(draft.getValueOptions({}));
    }
    default:
      return [];
  }
}

function parseTsv(text: string, properties: string[]): VariableValueOption[] {
  const lines = text.split('\n').filter((line) => line.trim());
  if (!lines.length) {
    return [];
  }

  const firstLineCols = lines[0].split('\t').map((c) => c.trim());
  const hasHeader = firstLineCols.every((col) => properties.includes(col));

  const headers = hasHeader ? firstLineCols : properties;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cols = line.split('\t').map((c) => c.trim());
    const props: VariableValueOptionProperties = {};
    headers.forEach((key, i) => {
      props[key] = cols[i] ?? '';
    });

    return {
      label: String(props.text ?? props.value ?? ''),
      value: String(props.value ?? ''),
      properties: props,
    };
  });
}

export function useClipboard(): { text: string; format: ClipboardTextFormat; clear: () => Promise<void> } {
  const [text, setText] = useState('');
  const format = useMemo(() => detectClipboardTextFormat(text), [text]);

  useEffect(() => {
    let cancelled = false;

    async function readClipboard() {
      if (!document.hasFocus()) {
        return;
      }
      try {
        const content = await navigator.clipboard.readText();
        if (!cancelled) {
          setText(content.trim());
        }
      } catch {
        if (!cancelled) {
          setText('');
        }
      }
    }

    readClipboard();

    window.addEventListener('focus', readClipboard);
    document.addEventListener('copy', readClipboard);
    document.addEventListener('cut', readClipboard);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', readClipboard);
      document.removeEventListener('copy', readClipboard);
      document.removeEventListener('cut', readClipboard);
    };
  }, []);

  const clear = useCallback(async () => {
    try {
      await navigator.clipboard.writeText('');
    } catch {
      // noop
    }
    setText('');
  }, []);

  return { text, format, clear };
}
