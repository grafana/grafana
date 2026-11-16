import { useCallback, useState } from 'react';

import { store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { RadioButtonGroup } from '@grafana/ui';

const INLINE_DIFF_STORE_KEY = 'grafana.monaco-diff-editor.inline';

/** Inline vs side-by-side diff preference, persisted across surfaces and sessions. */
export function useInlineDiffPreference(): [boolean, (inline: boolean) => void] {
  const [inline, setInline] = useState(() => store.getBool(INLINE_DIFF_STORE_KEY, false));

  const set = useCallback((value: boolean) => {
    setInline(value);
    store.set(INLINE_DIFF_STORE_KEY, value);
  }, []);

  return [inline, set];
}

export function InlineDiffToggle({ value, onChange }: { value: boolean; onChange: (inline: boolean) => void }) {
  const options = [
    { label: t('monaco-diff-editor.view-side-by-side', 'Side by side'), value: false },
    { label: t('monaco-diff-editor.view-inline', 'Inline'), value: true },
  ];

  return <RadioButtonGroup options={options} value={value} onChange={onChange} />;
}
