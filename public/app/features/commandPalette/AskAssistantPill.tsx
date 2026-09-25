import { css } from '@emotion/css';
import { useKBar } from 'kbar';
import { useCallback, useEffect, useRef } from 'react';

import { OpenAssistantButton, useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

/**
 * Button in the command palette search row offering to ask the Grafana Assistant, together with its Shift+Enter
 * shortcut. Deep search almost always returns something, so the empty state (and its "ask the assistant" button)
 * rarely shows anymore — this keeps that escape hatch reachable while results exist. Renders nothing when
 * the assistant is unavailable or the search query is empty.
 */
export function AskAssistantPill() {
  const styles = useStyles2(getStyles);
  const { query, searchQuery } = useKBar((state) => ({ searchQuery: state.searchQuery }));
  const { isAvailable: isAssistantAvailable, openAssistant } = useAssistant();
  const canAskAssistant = isAssistantAvailable && openAssistant !== undefined && searchQuery.length > 0;

  // Only used by the shortcut — clicks go through OpenAssistantButton, which opens the assistant itself
  const onAskAssistant = useCallback(() => {
    // canAskAssistant already implies openAssistant is defined; the extra check only narrows the type
    if (!canAskAssistant || !openAssistant) {
      return;
    }
    reportInteraction('command_palette_ask_assistant', { trigger: 'shortcut' });
    openAssistant({
      origin: 'grafana/command-palette',
      prompt: `Search for ${searchQuery}`,
    });
    query.toggle();
  }, [canAskAssistant, openAssistant, searchQuery, query]);

  // Shift+Enter asks the assistant from anywhere in the palette. Window capture for the same reason as the
  // navigation handler in RenderResults: global handlers (kbar's input focus guard, keybindingSrv) must not act
  // first. State is read through refs so the listener registers once — onAskAssistant depends on searchQuery and
  // would re-register the listener on every input change.
  const onAskAssistantRef = useRef(onAskAssistant);
  onAskAssistantRef.current = onAskAssistant;
  const canAskAssistantRef = useRef(canAskAssistant);
  canAskAssistantRef.current = canAskAssistant;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }
      if (!canAskAssistantRef.current) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      onAskAssistantRef.current();
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, []);

  if (!canAskAssistant) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <OpenAssistantButton
        origin="grafana/command-palette"
        prompt={`Search for ${searchQuery}`}
        title={t('command-palette.search-box.ask-assistant', 'Shift + Enter to ask Assistant')}
        onClick={() => {
          reportInteraction('command_palette_ask_assistant', { trigger: 'input-pill' });
          query.toggle();
        }}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    label: 'ask-assistant-pill',
    flexShrink: 0,
    marginLeft: theme.spacing(1),
  }),
});
