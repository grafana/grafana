import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';

import {
  AnnotationQuery,
  DataSourceInstanceSettings,
  getDataSourceRef,
  GrafanaTheme2,
  SelectableValue,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { dataLayers, VizPanel } from '@grafana/scenes';
import { AnnotationPanelFilter } from '@grafana/schema/src/raw/dashboard/x/dashboard_types.gen';
import {
  Button,
  Checkbox,
  Field,
  FieldSet,
  HorizontalGroup,
  Input,
  MultiSelect,
  Select,
  useStyles2,
  Stack,
} from '@grafana/ui';
import { ColorValueEditor } from 'app/core/components/OptionsUI/color';
import StandardAnnotationQueryEditor from 'app/features/annotations/components/StandardAnnotationQueryEditor';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { getPanelIdForVizPanel } from '../../utils/utils';

import { AngularEditorLoader } from './AngularEditorLoader';

type Props = {
  annotationLayer: dataLayers.AnnotationsDataLayer;
  editIndex: number;
  panels: VizPanel[];
  onUpdate: (annotation: AnnotationQuery, editIndex: number) => void;
  goBackToList: () => void;
  onDelete: (index: number) => void;
  onPreview: () => void;
};

export const newAnnotationName = 'New annotation';

export const AnnotationSettingsEdit = ({
  annotationLayer,
  editIndex,
  panels,
  onUpdate,
  goBackToList,
  onDelete,
  onPreview,
}: Props) => {
  const styles = useStyles2(getStyles);
  const { query } = annotationLayer.useState();

  const panelFilter = useMemo(() => {
    if (!query.filter) {
      return PanelFilterType.AllPanels;
    }
    return query.filter.exclude ? PanelFilterType.ExcludePanels : PanelFilterType.IncludePanels;
  }, [query.filter]);

  const { value: ds } = useAsync(() => {
    return getDataSourceSrv().get(query.datasource);
  }, [query.datasource]);

  const dsi = getDataSourceSrv().getInstanceSettings(query.datasource);

  const onNameChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    onUpdate(
      {
        ...query,
        name: ev.currentTarget.value,
      },
      editIndex
    );
  };

  const onDataSourceChange = (ds: DataSourceInstanceSettings) => {
    const dsRef = getDataSourceRef(ds);

    if (query.datasource?.type !== dsRef.type) {
      onUpdate(
        {
          datasource: dsRef,
          builtIn: query.builtIn,
          enable: query.enable,
          iconColor: query.iconColor,
          name: query.name,
          hide: query.hide,
          filter: query.filter,
          mappings: query.mappings,
          type: query.type,
        },
        editIndex
      );
    } else {
      onUpdate(
        {
          ...query,
          datasource: dsRef,
        },
        editIndex
      );
    }
  };

  const onChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    const target = ev.currentTarget;
    onUpdate(
      {
        ...query,
        [target.name]: target.type === 'checkbox' ? target.checked : target.value,
      },
      editIndex
    );
  };

  const onColorChange = (color?: string) => {
    onUpdate(
      {
        ...query,
        iconColor: color!,
      },
      editIndex
    );
  };

  const onFilterTypeChange = (v: SelectableValue<PanelFilterType>) => {
    let filter =
      v.value === PanelFilterType.AllPanels
        ? undefined
        : {
            exclude: v.value === PanelFilterType.ExcludePanels,
            ids: query.filter?.ids ?? [],
          };
    onUpdate({ ...query, filter }, editIndex);
  };

  const onAddFilterPanelID = (selections: Array<SelectableValue<number>>) => {
    if (!Array.isArray(selections)) {
      return;
    }

    const filter: AnnotationPanelFilter = {
      exclude: panelFilter === PanelFilterType.ExcludePanels,
      ids: [],
    };

    selections.forEach((selection) => selection.value && filter.ids.push(selection.value));
    onUpdate({ ...query, filter }, editIndex);
  };

  const onApply = goBackToList;

  const onDeleteAndLeavePage = () => {
    onDelete(editIndex);
    goBackToList();
  };

  const isNewAnnotation = query.name === newAnnotationName;

  const sortFn = (a: SelectableValue<number>, b: SelectableValue<number>) => {
    if (a.label && b.label) {
      return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
    }

    return -1;
  };

  const selectablePanels: Array<SelectableValue<number>> = useMemo(
    () =>
      panels
        // Filtering out rows at the moment, revisit to only include panels that support annotations
        // However the information to know if a panel supports annotations requires it to be already loaded
        // panel.plugin?.dataSupport?.annotations
        .filter((panel) => config.panels[panel.state.pluginId])
        .map((panel) => ({
          value: getPanelIdForVizPanel(panel),
          label: panel.state.title ?? `Panel ${getPanelIdForVizPanel(panel)}`,
          description: panel.state.description,
          imgUrl: config.panels[panel.state.pluginId].info.logos.small,
        }))
        .sort(sortFn) ?? [],
    [panels]
  );

  return (
    <div>
      <FieldSet className={styles.settingsForm}>
        <Field label="Name">
          <Input
            data-testid={selectors.pages.Dashboard.Settings.Annotations.Settings.name}
            name="name"
            id="name"
            autoFocus={isNewAnnotation}
            value={query.name}
            onChange={onNameChange}
          />
        </Field>
        <Field label="Data source" htmlFor="data-source-picker">
          <DataSourcePicker annotations variables current={query.datasource} onChange={onDataSourceChange} />
        </Field>
        <Field label="Enabled" description="When enabled the annotation query is issued every dashboard refresh">
          <Checkbox
            name="enable"
            id="enable"
            value={query.enable}
            onChange={onChange}
            data-testid={selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.enable}
          />
        </Field>
        <Field
          label="Hidden"
          description="Annotation queries can be toggled on or off at the top of the dashboard. With this option checked this toggle will be hidden."
        >
          <Checkbox
            name="hide"
            id="hide"
            value={query.hide}
            onChange={onChange}
            data-testid={selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.hide}
          />
        </Field>
        <Field label="Color" description="Color to use for the annotation event markers">
          <HorizontalGroup>
            <ColorValueEditor value={query?.iconColor} onChange={onColorChange} />
          </HorizontalGroup>
        </Field>
        <Field label="Show in" data-testid={selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.showInLabel}>
          <>
            <Select
              options={panelFilters}
              value={panelFilter}
              onChange={onFilterTypeChange}
              data-testid={selectors.components.Annotations.annotationsTypeInput}
            />
            {panelFilter !== PanelFilterType.AllPanels && (
              <MultiSelect
                options={selectablePanels}
                value={selectablePanels.filter((panel) => query.filter?.ids.includes(panel.value!))}
                onChange={onAddFilterPanelID}
                isClearable={true}
                placeholder="Choose panels"
                width={100}
                closeMenuOnSelect={false}
                className={styles.select}
                data-testid={selectors.components.Annotations.annotationsChoosePanelInput}
              />
            )}
          </>
        </Field>
      </FieldSet>
      <FieldSet>
        <h3 className="page-heading">Query</h3>
        {ds?.annotations && dsi && (
          <StandardAnnotationQueryEditor
            datasource={ds}
            datasourceInstanceSettings={dsi}
            annotation={query}
            onChange={(annotation) => onUpdate(annotation, editIndex)}
          />
        )}
        {ds && !ds.annotations && (
          <AngularEditorLoader
            datasource={ds}
            annotation={query}
            onChange={(annotation) => onUpdate(annotation, editIndex)}
          />
        )}
      </FieldSet>
      <Stack>
        {!query.builtIn && (
          <Button
            variant="destructive"
            onClick={onDeleteAndLeavePage}
            data-testid={selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.delete}
          >
            Delete
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={onPreview}
          data-testid={selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.previewInDashboard}
        >
          Preview in dashboard
        </Button>
        <Button
          variant="primary"
          onClick={onApply}
          data-testid={selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.apply}
        >
          Apply
        </Button>
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    settingsForm: css({
      maxWidth: theme.spacing(60),
      marginBottom: theme.spacing(2),
    }),
    select: css({
      marginTop: '8px',
    }),
  };
};

// Synthetic type
enum PanelFilterType {
  AllPanels,
  IncludePanels,
  ExcludePanels,
}

const panelFilters = [
  {
    label: 'All panels',
    value: PanelFilterType.AllPanels,
    description: 'Send the annotation data to all panels that support annotations',
  },
  {
    label: 'Selected panels',
    value: PanelFilterType.IncludePanels,
    description: 'Send the annotations to the explicitly listed panels',
  },
  {
    label: 'All panels except',
    value: PanelFilterType.ExcludePanels,
    description: 'Do not send annotation data to the following panels',
  },
];
