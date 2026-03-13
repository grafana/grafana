import { useState, useEffect, useCallback } from 'react';
import { firstValueFrom } from 'rxjs';

import { CustomVariable, VariableValueOption, VariableValueOptionProperties } from '@grafana/scenes';

type ClipboardTextFormat = 'tsv' | 'json' | 'csv' | undefined;

export function useClipboard(): { text: string; clear: () => void } {
  const [text, setText] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function check() {
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

    check();

    const onFocus = () => check();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
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

  return { text, clear };
}

export function detectClipboardTextFormat(text: string): ClipboardTextFormat {
  if (text.includes('\t')) {
    return 'tsv';
  }
  if (text.startsWith('[')) {
    return 'json';
  }
  if (text.includes(',')) {
    return 'csv';
  }
  return undefined;
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
