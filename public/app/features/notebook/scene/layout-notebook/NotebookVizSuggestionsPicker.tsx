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
 * Lets the user pick from the same top-N suggestions PanelQueryEditor auto-applies from, instead of
 * only ever getting the #1 pick. Keyed by `hash`, not `pluginId` — a plugin can offer more than one
 * suggestion variant.
 */
export function NotebookVizSuggestionsPicker({ panel, suggestions }: Props) {
  const [selectedHash, setSelectedHash] = useState<string | undefined>(
    () => suggestions.find((s) => s.pluginId === panel.state.pluginId)?.hash ?? suggestions[0]?.hash
  );

  // Defaults to whichever suggestion matches the panel's actual current type, not just the top one.
  // Reads panel.state directly (not panel.useState()) so picking an option below doesn't re-trigger this.
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
