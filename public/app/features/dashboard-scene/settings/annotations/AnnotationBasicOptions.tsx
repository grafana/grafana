import { useCallback, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';
import { usePanelPluginMetas } from '@grafana/runtime/internal';
import { VizPanel } from '@grafana/scenes';
import { AnnotationPanelFilter } from '@grafana/schema/src/raw/dashboard/x/dashboard_types.gen';
import { Checkbox, Combobox, ComboboxOption, Field, Input, MultiCombobox, Stack } from '@grafana/ui';
import { ColorValueEditor } from 'app/core/components/OptionsUI/color';

import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getDashboardSceneFor, getPanelIdForVizPanel } from '../../utils/utils';

import { AnnotationLayer } from './AnnotationEditableElement';

/** Helper to update the layer's query and optionally re-run the layer */
function updateLayerQuery(
  layer: AnnotationLayer,
  queryUpdate: Partial<AnnotationLayer['state']['query']>,
  runLayer = false
) {
  layer.setState({ query: { ...layer.state.query, ...queryUpdate } });
  if (runLayer) {
    layer.runLayer();
  }
}

export function AnnotationNameInput({ layer }: { layer: AnnotationLayer }) {
  const { name } = layer.useState();
  const oldName = useRef(name);

  return (
    <Field label={t('dashboard.edit-pane.annotation.name', 'Name')} noMargin>
      <Input
        value={name}
        onFocus={() => {
          oldName.current = name;
        }}
        onChange={(e) => {
          layer.setState({ name: e.currentTarget.value });
        }}
        onBlur={() => {
          // Update the query name as well to keep them in sync
          if (oldName.current !== name) {
            layer.setState({
              query: {
                ...layer.state.query,
                name,
              },
            });
          }
        }}
      />
    </Field>
  );
}

export function AnnotationEnabledCheckbox({ layer }: { layer: AnnotationLayer }) {
  const { isEnabled, query } = layer.useState();

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const enabled = e.currentTarget.checked;

      layer.setState({
        isEnabled: enabled,
        query: {
          ...query,
          enable: enabled,
        },
      });
    },
    [layer, query]
  );

  return (
    <Field
      label={t('dashboard.edit-pane.annotation.enabled', 'Enabled')}
      description={t(
        'dashboard.edit-pane.annotation.enabled-description',
        'When enabled the annotation query is issued every dashboard refresh'
      )}
      noMargin
    >
      <Checkbox value={isEnabled} onChange={onChange} />
    </Field>
  );
}

export function AnnotationColorPicker({ layer }: { layer: AnnotationLayer }) {
  const { query } = layer.useState();

  const onColorChange = useCallback(
    (color: string | undefined) => {
      if (color) {
        updateLayerQuery(layer, { iconColor: color }, true);
      }
    },
    [layer]
  );

  return (
    <Field
      label={t('dashboard.edit-pane.annotation.color', 'Color')}
      description={t(
        'dashboard.edit-pane.annotation.color-description',
        'Color to use for the annotation event markers'
      )}
      noMargin
    >
      <Stack>
        <ColorValueEditor value={query?.iconColor ?? 'red'} onChange={onColorChange} />
      </Stack>
    </Field>
  );
}

enum AnnotationControlsDisplay {
  Hidden,
  AboveDashboard,
  InControlsMenu,
}

export function AnnotationControlsDisplayPicker({ layer }: { layer: AnnotationLayer }) {
  const { isHidden, placement } = layer.useState();

  const options = useMemo(
    () => [
      {
        value: AnnotationControlsDisplay.AboveDashboard,
        label: t('dashboard.edit-pane.annotation.display-options.above-dashboard', 'Above dashboard'),
      },
      {
        value: AnnotationControlsDisplay.InControlsMenu,
        label: t('dashboard.edit-pane.annotation.display-options.controls-menu', 'Controls menu'),
        description: t(
          'dashboard.edit-pane.annotation.display-options.controls-menu-description',
          'Can be accessed when the controls menu is open'
        ),
      },
      {
        value: AnnotationControlsDisplay.Hidden,
        label: t('dashboard.edit-pane.annotation.display-options.hidden', 'Hidden'),
        description: t(
          'dashboard.edit-pane.annotation.display-options.hidden-description',
          'Hides the toggle for turning this annotation on or off'
        ),
      },
    ],
    []
  );

  const currentValue = useMemo(() => {
    if (isHidden) {
      return AnnotationControlsDisplay.Hidden;
    }
    if (placement === 'inControlsMenu') {
      return AnnotationControlsDisplay.InControlsMenu;
    }
    return AnnotationControlsDisplay.AboveDashboard;
  }, [isHidden, placement]);

  const onChange = useCallback(
    (option: ComboboxOption<AnnotationControlsDisplay>) => {
      const newPlacement = option.value === AnnotationControlsDisplay.InControlsMenu ? 'inControlsMenu' : undefined;
      const newIsHidden = option.value === AnnotationControlsDisplay.Hidden;

      layer.setState({
        placement: newPlacement,
        isHidden: newIsHidden,
        query: {
          ...layer.state.query,
          hide: newIsHidden,
          placement: newPlacement,
        },
      });

      // Force parent DashboardDataLayerSet to update its state so components that filter
      // annotationLayers (like DashboardDataLayerControls and DashboardControlsMenu) re-render
      const dataLayerSet = layer.parent;
      if (dataLayerSet instanceof DashboardDataLayerSet) {
        dataLayerSet.setState({ annotationLayers: [...dataLayerSet.state.annotationLayers] });
      }
    },
    [layer]
  );

  return (
    <Field label={t('dashboard.edit-pane.annotation.display', 'Show annotation controls in')} noMargin>
      <Combobox options={options} value={currentValue} onChange={onChange} width="auto" minWidth={100} />
    </Field>
  );
}

enum PanelFilterType {
  AllPanels,
  IncludePanels,
  ExcludePanels,
}

export function AnnotationPanelFilterPicker({ layer }: { layer: AnnotationLayer }) {
  const {
    panelFilterOptions,
    panelFilter,
    onPanelFilterChange,
    selectablePanels,
    selectedPanels,
    onSelectedPanelsChange,
  } = useAnnotationPanelFilterPicker(layer);

  return (
    <Field label={t('dashboard.edit-pane.annotation.show-in', 'Show in')} noMargin>
      <Stack direction="column" gap={1}>
        <Combobox
          options={panelFilterOptions}
          value={panelFilter}
          onChange={onPanelFilterChange}
          width="auto"
          minWidth={100}
        />
        {panelFilter !== PanelFilterType.AllPanels && (
          <MultiCombobox
            options={selectablePanels}
            value={selectedPanels}
            onChange={onSelectedPanelsChange}
            isClearable={true}
            placeholder={t('dashboard.edit-pane.annotation.choose-panels', 'Choose panels')}
          />
        )}
      </Stack>
    </Field>
  );
}

const collator = Intl.Collator();
const sortOptionByLabelFn = (a: ComboboxOption<number>, b: ComboboxOption<number>) =>
  collator.compare(a.label ?? '', b.label ?? '');

function useSelectablePanelOptions(layer: AnnotationLayer): Array<ComboboxOption<number>> {
  const { value: panelPlugins = [] } = usePanelPluginMetas();

  return useMemo(() => {
    const byPluginIdSet = new Set(panelPlugins.map((p) => p.id));

    let panels: VizPanel[];
    try {
      panels = dashboardSceneGraph.getVizPanels(getDashboardSceneFor(layer));
    } catch {
      panels = [];
    }

    return (
      panels
        // revisit to only include panels that support annotations
        .filter((panel) => byPluginIdSet.has(panel.state.pluginId))
        .map((panel) => ({
          value: getPanelIdForVizPanel(panel),
          label: panel.state.title ?? `Panel ${getPanelIdForVizPanel(panel)}`,
          description: panel.state.description,
        }))
        .sort(sortOptionByLabelFn)
    );
  }, [panelPlugins, layer]);
}

function useAnnotationPanelFilterPicker(layer: AnnotationLayer) {
  const { query } = layer.useState();

  const panelFilterOptions = useMemo(
    () => [
      {
        label: t('dashboard.edit-pane.annotation.panel-filter.all-panels', 'All panels'),
        value: PanelFilterType.AllPanels,
        description: t(
          'dashboard.edit-pane.annotation.panel-filter.all-panels-description',
          'Send the annotation data to all panels that support annotations'
        ),
      },
      {
        label: t('dashboard.edit-pane.annotation.panel-filter.selected-panels', 'Selected panels'),
        value: PanelFilterType.IncludePanels,
        description: t(
          'dashboard.edit-pane.annotation.panel-filter.selected-panels-description',
          'Send the annotations to the explicitly listed panels'
        ),
      },
      {
        label: t('dashboard.edit-pane.annotation.panel-filter.all-panels-except', 'All panels except'),
        value: PanelFilterType.ExcludePanels,
        description: t(
          'dashboard.edit-pane.annotation.panel-filter.all-panels-except-description',
          'Do not send annotation data to the following panels'
        ),
      },
    ],
    []
  );

  const panelFilter = useMemo(() => {
    if (!query?.filter) {
      return PanelFilterType.AllPanels;
    }
    return query.filter.exclude ? PanelFilterType.ExcludePanels : PanelFilterType.IncludePanels;
  }, [query?.filter]);

  const onPanelFilterChange = useCallback(
    (option: ComboboxOption<PanelFilterType>) => {
      const filter: AnnotationPanelFilter | undefined =
        option.value === PanelFilterType.AllPanels
          ? undefined
          : {
              exclude: option.value === PanelFilterType.ExcludePanels,
              ids: query?.filter?.ids ?? [],
            };
      updateLayerQuery(layer, { filter }, true);
    },
    [layer, query?.filter?.ids]
  );

  const onSelectedPanelsChange = useCallback(
    (selections: Array<ComboboxOption<number>>) => {
      const filter: AnnotationPanelFilter = {
        exclude: panelFilter === PanelFilterType.ExcludePanels,
        ids: selections.map((selection) => selection.value).filter(Boolean),
      };
      updateLayerQuery(layer, { filter }, true);
    },
    [layer, panelFilter]
  );

  const selectablePanels = useSelectablePanelOptions(layer);

  return {
    panelFilterOptions,
    panelFilter,
    onPanelFilterChange,
    selectablePanels,
    selectedPanels: query?.filter?.ids ?? [],
    onSelectedPanelsChange,
  };
}
