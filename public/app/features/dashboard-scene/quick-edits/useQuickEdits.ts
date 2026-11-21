import { useMemo } from 'react';

import {
  type FieldConfigSource,
  type PanelPlugin,
  type PanelPluginVisualizationSuggestion,
  type PanelQuickEditSummary,
} from '@grafana/data';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { type OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { getVisualizationOptions2 } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';

import { changeViewPanelFieldConfig, changeViewPanelOptions } from '../actions/panel/changeViewPanelOptions';
import { createPresetApplyHandler } from '../panel-edit/getPanelFrameOptions';

export interface ResolvedQuickEdit {
  quickEdit: ReturnType<PanelPlugin['getQuickEdits']>[number];
  summary?: PanelQuickEditSummary;
  /** The full editor's items for the options the quick edit names that this panel offers, in its order. */
  items: OptionsPaneItemDescriptor[];
}

export interface QuickEdits {
  edits: ResolvedQuickEdit[];
  applyPreset: (preset: PanelPluginVisualizationSuggestion, prevFieldConfig: FieldConfigSource) => void;
}

/**
 * The quick edits the panel's plugin declares, built from the same option items as the full editor, so each control
 * is the real editor and each change is an ordinary undoable edit. A quick edit is left out when the panel offers
 * none of its options.
 */
export function useQuickEdits(panel: VizPanel, enabled = true): QuickEdits {
  const { options, fieldConfig, _pluginInstanceState } = panel.useState();
  const { data } = sceneGraph.getData(panel).useState();
  const plugin = panel.getPlugin();

  const edits = useMemo(() => {
    const declared = enabled && plugin ? plugin.getQuickEdits() : [];
    if (!plugin || !declared.length) {
      return [];
    }
    const categories = getVisualizationOptions2({
      panel,
      data,
      plugin,
      eventBus: panel.getPanelContext().eventBus,
      instanceState: _pluginInstanceState,
      currentOptions: options,
      currentFieldConfig: fieldConfig,
      reportInteractionUI: 'quick-edits',
      onOptionsChange: (next, name, category) => changeViewPanelOptions(panel, next, name, category),
      onFieldConfigChange: (next, name, category) => changeViewPanelFieldConfig(panel, next, name, category),
    });
    const byId = new Map<string, OptionsPaneItemDescriptor>();
    const collect = (category: OptionsPaneCategoryDescriptor) => {
      category.items.forEach((item) => byId.set(item.props.id, item));
      category.categories.forEach(collect);
    };
    categories.forEach(collect);

    return declared.flatMap((quickEdit) => {
      const items = quickEdit.optionIds.flatMap((id) => {
        const item = byId.get(id);
        const label = quickEdit.labels?.[id];
        return item ? [label ? relabel(item, label) : item] : [];
      });
      const offered = quickEdit.presets ? plugin.hasPresetsSupplier() : items.length > 0;
      if (!offered) {
        return [];
      }
      return [{ quickEdit, items, summary: quickEdit.summary?.({ options, fieldConfig }) }];
    });
  }, [enabled, panel, plugin, data, options, fieldConfig, _pluginInstanceState]);

  const applyPreset = useMemo(() => createPresetApplyHandler(panel), [panel]);

  return { edits, applyPreset };
}

/** The same option item under another name, for options whose own name relies on their category. */
function relabel(item: OptionsPaneItemDescriptor, title: string) {
  const relabelled = new OptionsPaneItemDescriptor({ ...item.props, title });
  relabelled.parent = item.parent;
  return relabelled;
}
