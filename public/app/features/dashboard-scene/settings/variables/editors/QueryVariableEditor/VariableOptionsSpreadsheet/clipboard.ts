import { useCallback, useEffect, useState } from 'react';
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
      // invalid JSON
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

/**
 * - 'prompt': permission not requested yet, the first read will trigger the browser permission prompt
 * - 'granted': reads are prompt-free, so we can probe the clipboard to reflect its content in the UI
 * - 'denied': the user blocked clipboard access, it can only be re-enabled via the browser site settings
 * - 'gesture-only': the Permissions API does not expose clipboard-read (Firefox, Safari), every read
 *   must happen in a user gesture and may show a native per-use paste prompt
 */
export type ClipboardAccess = 'prompt' | 'granted' | 'denied' | 'gesture-only';

export function useClipboardPaste() {
  const [access, setAccess] = useState<ClipboardAccess>('gesture-only');
  const [clipboardText, setClipboardText] = useState<string | null>(null);
  const [lastImported, setLastImported] = useState<string | null>(null);

  useEffect(() => {
    let status: PermissionStatus | undefined;
    let disposed = false;

    const sync = () => {
      if (!disposed && status) {
        setAccess(status.state);
      }
    };

    try {
      // 'clipboard-read' is Chromium-specific and missing from the TypeScript PermissionName union,
      // hence this widened view of the Permissions API
      const permissions: { query(descriptor: { name: string }): Promise<PermissionStatus> } = navigator.permissions;

      // Detects the permission state without triggering a prompt. Firefox and Safari
      // reject 'clipboard-read' queries, in which case we stay in 'gesture-only' mode.
      permissions
        .query({ name: 'clipboard-read' })
        .then((result) => {
          status = result;
          sync();
          result.addEventListener('change', sync);
        })
        .catch(() => {});
    } catch {
      // Permissions API not available at all
    }

    return () => {
      disposed = true;
      status?.removeEventListener('change', sync);
    };
  }, []);

  const probe = useCallback(async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      setClipboardText(text && detectClipboardTextFormat(text) ? text : null);
    } catch {
      // Permission revoked mid-session
    }
  }, []);

  // Probing outside a user gesture is acceptable only once permission has been
  // granted: reads are then prompt-free
  useEffect(() => {
    if (access !== 'granted') {
      return;
    }
    probe();
    window.addEventListener('focus', probe);
    return () => window.removeEventListener('focus', probe);
  }, [access, probe]);

  const readClipboard = useCallback(async (): Promise<string | null> => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      return text || null;
    } catch {
      // Don't infer 'denied' here: a dismissed prompt also rejects, but the permission
      // stays in 'prompt' and the browser will re-prompt on the next click.
      // Real blocks flip the state via the PermissionStatus 'change' listener.
      return null;
    }
  }, []);

  // Remembering what was imported (instead of erasing the user's clipboard) lets us
  // disable the paste button until the clipboard content changes
  const markImported = useCallback((text: string) => {
    setLastImported(text);
    setClipboardText(text);
  }, []);

  const clipboardFormat = clipboardText ? detectClipboardTextFormat(clipboardText) : undefined;

  const canPaste =
    access === 'prompt' ||
    access === 'gesture-only' ||
    (access === 'granted' && clipboardText !== null && clipboardText !== lastImported);

  return { access, canPaste, clipboardFormat, readClipboard, markImported };
}
