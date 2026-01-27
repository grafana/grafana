import { useCallback, useId, useMemo, useRef } from 'react';
import { useAsync } from 'react-use';

import { DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { dataLayers, VizPanel } from '@grafana/scenes';
import { AnnotationPanelFilter } from '@grafana/schema/src/raw/dashboard/x/dashboard_types.gen';
import { Checkbox, Combobox, ComboboxOption, Field, Input, MultiCombobox, Stack } from '@grafana/ui';
import { ColorValueEditor } from 'app/core/components/OptionsUI/color';
import StandardAnnotationQueryEditor from 'app/features/annotations/components/StandardAnnotationQueryEditor';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getDashboardSceneFor, getPanelIdForVizPanel } from '../../utils/utils';

type AnnotationLayer = dataLayers.AnnotationsDataLayer | DashboardAnnotationsDataLayer;

enum AnnotationControlsDisplay {
  Hidden,
  AboveDashboard,
  InControlsMenu,
}

enum PanelFilterType {
  AllPanels,
  IncludePanels,
  ExcludePanels,
}

const getPanelFilterOptions = () => [
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
];

function getSelectablePanels(panels: VizPanel[]): Array<ComboboxOption<number>> {
  const collator = Intl.Collator();
  const sortFn = (a: ComboboxOption<number>, b: ComboboxOption<number>) =>
    collator.compare(a.label ?? '', b.label ?? '');

  return panels
    .filter((panel) => config.panels[panel.state.pluginId])
    .map((panel) => ({
      value: getPanelIdForVizPanel(panel),
      label: panel.state.title ?? `Panel ${getPanelIdForVizPanel(panel)}`,
      description: panel.state.description,
    }))
    .sort(sortFn);
}

function useEditPaneOptions(this: AnnotationEditableElement): OptionsPaneCategoryDescriptor[] {
  const annotationCategoryId = useId();
  const annotationNameId = useId();
  const dataSourceId = useId();
  const enabledId = useId();
  const colorId = useId();
  const displayId = useId();
  const showInId = useId();
  const queryCategoryId = useId();

  const basicOptions = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: annotationCategoryId })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: annotationNameId,
          render: () => <AnnotationNameInput layer={this.layer} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: dataSourceId,
          render: () => <AnnotationDataSourcePicker layer={this.layer} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: enabledId,
          render: () => <AnnotationEnabledCheckbox layer={this.layer} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: colorId,
          render: () => <AnnotationColorPicker layer={this.layer} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: displayId,
          render: () => <AnnotationControlsDisplayPicker layer={this.layer} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: showInId,
          render: () => <AnnotationPanelFilterPicker layer={this.layer} />,
        })
      );
  }, [annotationCategoryId, annotationNameId, dataSourceId, enabledId, colorId, displayId, showInId]);

  const queryEditorId = useId();

  const queryOptions = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard.edit-pane.annotation.query', 'Query'),
      id: queryCategoryId,
    }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: queryEditorId,
        render: () => <AnnotationQueryEditor layer={this.layer} />,
      })
    );
  }, [queryCategoryId, queryEditorId]);

  return [basicOptions, queryOptions];
}

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

function AnnotationNameInput({ layer }: { layer: AnnotationLayer }) {
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

function AnnotationDataSourcePicker({ layer }: { layer: AnnotationLayer }) {
  const { query } = layer.useState();

  const onDataSourceChange = useCallback(
    (ds: DataSourceInstanceSettings) => {
      const dsRef = getDataSourceRef(ds);

      // If the data source type changed, reset the query to defaults
      if (query?.datasource?.type !== dsRef.type) {
        layer.setState({
          query: {
            name: query?.name,
            enable: query?.enable,
            iconColor: query?.iconColor,
            hide: query?.hide,
            datasource: dsRef,
          },
        });
        layer.runLayer();
      } else {
        updateLayerQuery(layer, { datasource: dsRef }, true);
      }
    },
    [layer, query]
  );

  return (
    <Field label={t('dashboard.edit-pane.annotation.data-source', 'Data source')} noMargin>
      <DataSourcePicker annotations variables current={query?.datasource} onChange={onDataSourceChange} />
    </Field>
  );
}

function AnnotationEnabledCheckbox({ layer }: { layer: AnnotationLayer }) {
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

function AnnotationColorPicker({ layer }: { layer: AnnotationLayer }) {
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

function AnnotationControlsDisplayPicker({ layer }: { layer: AnnotationLayer }) {
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

function AnnotationPanelFilterPicker({ layer }: { layer: AnnotationLayer }) {
  const { query } = layer.useState();

  const panelFilter = useMemo(() => {
    if (!query?.filter) {
      return PanelFilterType.AllPanels;
    }
    return query.filter.exclude ? PanelFilterType.ExcludePanels : PanelFilterType.IncludePanels;
  }, [query?.filter]);

  const panels = useMemo(() => {
    try {
      const dashboard = getDashboardSceneFor(layer);
      return dashboardSceneGraph.getVizPanels(dashboard);
    } catch {
      return [];
    }
  }, [layer]);

  const selectablePanels = useMemo(() => getSelectablePanels(panels), [panels]);

  const onFilterTypeChange = useCallback(
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

  const onAddFilterPanelID = useCallback(
    (selections: Array<ComboboxOption<number>>) => {
      const filter: AnnotationPanelFilter = {
        exclude: panelFilter === PanelFilterType.ExcludePanels,
        ids: selections.map((selection) => selection.value).filter(Boolean),
      };
      updateLayerQuery(layer, { filter }, true);
    },
    [layer, panelFilter]
  );

  return (
    <Field label={t('dashboard.edit-pane.annotation.show-in', 'Show in')} noMargin>
      <Stack direction="column" gap={1}>
        <Combobox
          options={getPanelFilterOptions()}
          value={panelFilter}
          onChange={onFilterTypeChange}
          width="auto"
          minWidth={100}
        />
        {panelFilter !== PanelFilterType.AllPanels && (
          <MultiCombobox
            options={selectablePanels}
            value={query?.filter?.ids ?? []}
            onChange={onAddFilterPanelID}
            isClearable={true}
            placeholder={t('dashboard.edit-pane.annotation.choose-panels', 'Choose panels')}
          />
        )}
      </Stack>
    </Field>
  );
}

function AnnotationQueryEditor({ layer }: { layer: AnnotationLayer }) {
  const { query } = layer.useState();

  const { value: ds } = useAsync(() => {
    return getDataSourceSrv().get(query?.datasource);
  }, [query?.datasource]);

  const dsi = getDataSourceSrv().getInstanceSettings(query?.datasource);

  const onChange = useCallback(
    (newQuery: typeof query) => {
      layer.setState({ query: newQuery });
      layer.runLayer();
    },
    [layer]
  );

  if (!ds?.annotations || !dsi || !query) {
    return null;
  }

  return (
    <StandardAnnotationQueryEditor
      datasource={ds}
      datasourceInstanceSettings={dsi}
      annotation={query}
      onChange={onChange}
    />
  );
}

export class AnnotationEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(public layer: AnnotationLayer) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.annotation', 'Annotation'),
      icon: 'comment-alt',
      instanceName: this.layer.state.name,
      isHidden: this.layer.state.isHidden,
    };
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this);

  public onDelete() {
    const dataLayerSet = this.layer.parent;

    if (dataLayerSet instanceof DashboardDataLayerSet) {
      dashboardEditActions.removeAnnotation({
        source: dataLayerSet,
        removedObject: this.layer,
      });
    }
  }
}
