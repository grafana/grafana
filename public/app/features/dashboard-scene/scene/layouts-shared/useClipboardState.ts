import { useEffect, useState } from 'react';

import { store } from '@grafana/data';
import { LS_PANEL_COPY_KEY, LS_ROW_COPY_KEY, LS_TAB_COPY_KEY } from 'app/core/constants';

export function useClipboardState() {
  const [hasCopiedPanel, setHasCopiedPanel] = useState(store.exists(LS_PANEL_COPY_KEY));
  const [hasCopiedRow, setHasCopiedRow] = useState(store.exists(LS_ROW_COPY_KEY));
  const [hasCopiedTab, setHasCopiedTab] = useState(store.exists(LS_TAB_COPY_KEY));

  useEffect(() => {
    const unsubscribe = store.subscribe(LS_PANEL_COPY_KEY, () => {
      setHasCopiedPanel(store.exists(LS_PANEL_COPY_KEY));
    });

    const unsubscribeRow = store.subscribe(LS_ROW_COPY_KEY, () => {
      setHasCopiedRow(store.exists(LS_ROW_COPY_KEY));
    });

    const unsubscribeTab = store.subscribe(LS_TAB_COPY_KEY, () => {
      setHasCopiedTab(store.exists(LS_TAB_COPY_KEY));
    });

    return () => {
      unsubscribe();
      unsubscribeRow();
      unsubscribeTab();
    };
  }, []);

  return {
    hasCopiedPanel,
    hasCopiedRow,
    hasCopiedTab,
  };
}
