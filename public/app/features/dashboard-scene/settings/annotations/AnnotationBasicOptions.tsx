import { useCallback, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';
import { usePanelPluginMetas } from '@grafana/runtime/internal';
import { VizPanel } from '@grafana/scenes';
import { AnnotationPanelFilter } from '@grafana/schema';
import { Checkbox, Combobox, ComboboxOption, Field, Input, MultiCombobox, Stack } from '@grafana/ui';
import { ColorValueEditor } from 'app/core/components/OptionsUI/color';

import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getDashboardSceneFor, getPanelIdForVizPanel } from '../../utils/utils';

import { AnnotationLayer } from './AnnotationEditableElement';
import { annotationEditActions } from './actions';

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
          annotationEditActions.changeAnnotationName({
            source: layer,
            oldValue: oldName.current,
            newValue: name,
          });
        }}
      />
    </Field>
  );
}

export function AnnotationEnabledCheckbox({ layer }: { layer: AnnotationLayer }) {
  const { isEnabled } = layer.useState();

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    annotationEditActions.changeAnnotationEnabled({
      source: layer,
      oldValue: Boolean(isEnabled),
      newValue: e.currentTarget.checked,
    });
  };

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
        annotationEditActions.changeAnnotationColor({
          source: layer,
          oldValue: query.iconColor,
          newValue: color,
        });
      }
    },
    [layer, query.iconColor]
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
        <ColorValueEditor value={query.iconColor ?? 'red'} onChange={onColorChange} />
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

  const onChange = useCallback(
    (option: ComboboxOption<AnnotationControlsDisplay>) => {
      const newIsHidden = option.value === AnnotationControlsDisplay.Hidden;
      const newPlacement = option.value === AnnotationControlsDisplay.InControlsMenu ? 'inControlsMenu' : undefined;

      annotationEditActions.changeAnnotationControlsDisplay({
        source: layer,
        oldValue: { isHidden: Boolean(isHidden), placement },
        newValue: { isHidden: newIsHidden, placement: newPlacement },
      });
    },
    [isHidden, layer, placement]
  );

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
          // hack to force re-render when undoing to "All panels" (value=0)
          key={panelFilter}
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
    if (!query.filter) {
      return PanelFilterType.AllPanels;
    }
    return query.filter.exclude ? PanelFilterType.ExcludePanels : PanelFilterType.IncludePanels;
  }, [query.filter]);

  const onPanelFilterChange = useCallback(
    (option: ComboboxOption<PanelFilterType>) => {
      const filter: AnnotationPanelFilter | undefined =
        option.value === PanelFilterType.AllPanels
          ? undefined
          : {
              exclude: option.value === PanelFilterType.ExcludePanels,
              ids: query.filter?.ids ?? [],
            };

      annotationEditActions.changeAnnotationPanelFilter({
        source: layer,
        oldValue: query.filter,
        newValue: filter,
      });
    },
    [layer, query.filter]
  );

  const onSelectedPanelsChange = useCallback(
    (selections: Array<ComboboxOption<number>>) => {
      const filter: AnnotationPanelFilter = {
        exclude: panelFilter === PanelFilterType.ExcludePanels,
        ids: selections.map((selection) => selection.value).filter(Boolean),
      };

      annotationEditActions.changeAnnotationPanelFilter({
        source: layer,
        oldValue: query.filter,
        newValue: filter,
      });
    },
    [layer, panelFilter, query.filter]
  );

  const selectablePanels = useSelectablePanelOptions(layer);

  return {
    panelFilterOptions,
    panelFilter,
    onPanelFilterChange,
    selectablePanels,
    selectedPanels: query.filter?.ids ?? [],
    onSelectedPanelsChange,
  };
}
