import { css } from '@emotion/css';
import { useKBar } from 'kbar';
import { useCallback, useEffect, useRef } from 'react';

import { useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Icon, useStyles2 } from '@grafana/ui';

/**
 * Pill in the command palette search row offering to ask the Grafana Assistant, together with its Shift+Enter
 * shortcut. Deep search almost always returns something, so the empty state (and its "ask the assistant" button)
 * rarely shows anymore — this keeps that escape hatch reachable while results exist. Renders nothing when
 * the assistant is unavailable or the search query is empty.
 */
export function AskAssistantPill() {
  const styles = useStyles2(getStyles);
  const { query, searchQuery } = useKBar((state) => ({ searchQuery: state.searchQuery }));
  const { isAvailable: isAssistantAvailable, openAssistant } = useAssistant();
  const canAskAssistant = isAssistantAvailable && openAssistant !== undefined && searchQuery.length > 0;

  const onAskAssistant = useCallback(
    (trigger: 'shortcut' | 'input-pill') => {
      // canAskAssistant already implies openAssistant is defined; the extra check only narrows the type
      if (!canAskAssistant || !openAssistant) {
        return;
      }
      reportInteraction('command_palette_ask_assistant', { trigger });
      openAssistant({
        origin: 'grafana/command-palette',
        prompt: `Search for ${searchQuery}`,
      });
      query.toggle();
    },
    [canAskAssistant, openAssistant, searchQuery, query]
  );

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
      onAskAssistantRef.current('shortcut');
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, []);

  if (!canAskAssistant) {
    return null;
  }

  return (
    <button type="button" className={styles.pill} onClick={() => onAskAssistant('input-pill')}>
      <Icon name="ai-sparkle" size="sm" />
      {t('command-palette.search-box.ask-assistant', 'Shift + Enter to ask Assistant')}
    </button>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  pill: css({
    label: 'ask-assistant-pill',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    marginLeft: theme.spacing(1),
    padding: theme.spacing(0.5, 1.5),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    borderRadius: theme.shape.radius.pill,
    // Gradient border: opaque inner background painted over the AI gradient,
    // which stays visible only in the transparent 1px border ring. Same
    // purple-to-orange gradient as the other assistant elements. The inner
    // background matches the search row the pill sits on.
    border: '1px solid transparent',
    background: `linear-gradient(${theme.components.input.background}, ${theme.components.input.background}) padding-box, linear-gradient(90deg, rgb(168, 85, 247), rgb(249, 115, 22)) border-box`,
    '&:hover, &:focus-visible': {
      color: theme.colors.text.primary,
      background: `linear-gradient(${theme.colors.emphasize(theme.components.input.background, 0.05)}, ${theme.colors.emphasize(theme.components.input.background, 0.05)}) padding-box, linear-gradient(90deg, rgb(168, 85, 247), rgb(249, 115, 22)) border-box`,
    },
  }),
});
