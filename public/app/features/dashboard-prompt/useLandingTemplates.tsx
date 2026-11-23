import { useCallback, useEffect, useId, useState } from 'react';

import { store } from '@grafana/data';
import { type TemplateSelection } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';

import { LandingTemplatesToggle, type TemplateCounts } from './LandingTemplates';

/** How the person last left the templates panel, open or closed, kept for their next visit. */
const OPEN_KEY = 'grafana.dashboard.landing.templatesOpen';
/** Whether the last visit found templates of the account's own, which opens the panel on the next one. */
const HAS_CUSTOM_KEY = 'grafana.dashboard.landing.hasCustomTemplates';

/**
 * The state of the templates under the new-dashboard prompt. Its toggle renders inside the Assistant's prompt and its
 * panel under the prompt, so the page places the two and this hook keeps their state: whether the panel is open, what
 * the lists offer, and the picked template.
 */
export function useLandingTemplates({ showCustomTemplates }: { showCustomTemplates: boolean }) {
  const panelId = useId();
  // The person's last toggle, or else open when the last visit found templates of the account's own. Read once, so the
  // panel never opens or closes by itself while the person is on the page; what this visit finds is kept for the next.
  const [openedByUser, setOpenedByUser] = useState(() =>
    store.exists(OPEN_KEY) ? store.getBool(OPEN_KEY, false) : undefined
  );
  const [hadCustomTemplates] = useState(() => store.getBool(HAS_CUSTOM_KEY, false));
  const isOpen = openedByUser ?? hadCustomTemplates;
  const [counts, setCounts] = useState<TemplateCounts>();
  const customTemplates = showCustomTemplates ? counts?.custom : 0;
  useEffect(() => {
    if (customTemplates !== undefined) {
      store.set(HAS_CUSTOM_KEY, customTemplates > 0);
    }
  }, [customTemplates]);

  const toggle = useCallback(() => {
    store.set(OPEN_KEY, !isOpen);
    setOpenedByUser(!isOpen);
  }, [isOpen]);
  const renderToggle = useCallback(
    () => <LandingTemplatesToggle isOpen={isOpen} onToggle={toggle} controls={panelId} />,
    [isOpen, toggle, panelId]
  );

  // The picked template travels to the Assistant as a pill in the prompt; picking it again takes it off.
  const [selected, setSelected] = useState<TemplateSelection>();
  const select = useCallback((selection: TemplateSelection) => {
    setSelected((current) => (current?.id === selection.id ? undefined : selection));
  }, []);
  const removePill = useCallback((id: string) => {
    setSelected((current) => (current?.contextItem.node.id === id ? undefined : current));
  }, []);
  const clearSelection = useCallback(() => setSelected(undefined), []);

  return {
    isOpen,
    counts,
    selected,
    removePill,
    clearSelection,
    renderToggle,
    panelProps: {
      id: panelId,
      isOpen,
      onTemplatesCount: setCounts,
      onSelectTemplate: select,
      selectedTemplateId: selected?.id,
    },
  };
}
