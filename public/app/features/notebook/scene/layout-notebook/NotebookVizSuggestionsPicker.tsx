import { useEffect, useState } from 'react';

import { type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { Combobox, Field, type ComboboxOption } from '@grafana/ui';

interface Props {
  panel: VizPanel;
  suggestions: PanelPluginVisualizationSuggestion[];
}

/**
 * Lets the user override the visualization PanelQueryEditor auto-applied on "Run query" by picking
 * from the same top-N suggestion list instead of only ever getting the #1 pick. Keyed by `hash`
 * rather than `pluginId` — a single plugin can contribute more than one suggestion variant.
 */
export function NotebookVizSuggestionsPicker({ panel, suggestions }: Props) {
  const [selectedHash, setSelectedHash] = useState<string | undefined>(
    () => suggestions.find((s) => s.pluginId === panel.state.pluginId)?.hash ?? suggestions[0]?.hash
  );

  // A fresh suggestion list means either a new run (which may or may not have auto-applied its top
  // pick) or the panel's already-saved type surfacing for the first time — either way, default to
  // whichever suggestion actually matches what the panel is showing right now, not just the top one.
  // Reads panel.state directly rather than panel.useState() so picking an option below (which changes
  // that same state) doesn't re-trigger this and fight a still-in-flight optimistic selection.
  useEffect(() => {
    setSelectedHash(suggestions.find((s) => s.pluginId === panel.state.pluginId)?.hash ?? suggestions[0]?.hash);
  }, [suggestions, panel]);

  const options: Array<ComboboxOption<string>> = suggestions.map((suggestion) => ({
    value: suggestion.hash,
    label: suggestion.name,
  }));

  const handleChange = (option: ComboboxOption<string> | null) => {
    const suggestion = suggestions.find((s) => s.hash === option?.value);
    if (!suggestion) {
      return;
    }
    setSelectedHash(suggestion.hash);
    panel.changePluginType(suggestion.pluginId, suggestion.options, suggestion.fieldConfig);
  };

  return (
    <Field label={t('notebook.cell.viz-suggestions.label', 'Suggested visualization')} noMargin>
      <Combobox
        options={options}
        value={selectedHash}
        onChange={handleChange}
        disabled={suggestions.length === 0}
        placeholder={t('notebook.cell.viz-suggestions.placeholder', 'Run a query to see suggestions')}
      />
    </Field>
  );
}
