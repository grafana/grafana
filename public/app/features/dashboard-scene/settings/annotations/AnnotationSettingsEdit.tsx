import { css } from '@emotion/css';
import { useMemo } from 'react';
import * as React from 'react';
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
import { VizPanel } from '@grafana/scenes';
import { AnnotationPanelFilter } from '@grafana/schema/src/raw/dashboard/x/dashboard_types.gen';
import { Button, Checkbox, Field, FieldSet, Input, MultiSelect, Select, useStyles2, Stack, Alert } from '@grafana/ui';
import { ColorValueEditor } from 'app/core/components/OptionsUI/color';
import { Trans, t } from 'app/core/internationalization';
import StandardAnnotationQueryEditor from 'app/features/annotations/components/StandardAnnotationQueryEditor';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { getPanelIdForVizPanel } from '../../utils/utils';

type Props = {
  annotation: AnnotationQuery;
  editIndex: number;
  panels: VizPanel[];
  onUpdate: (annotation: AnnotationQuery, editIndex: number) => void;
  onBackToList: () => void;
  onDelete: (index: number) => void;
};

export const newAnnotationName = 'New annotation';

export const AnnotationSettingsEdit = ({ annotation, editIndex, panels, onUpdate, onBackToList, onDelete }: Props) => {
  const styles = useStyles2(getStyles);

  const panelFilter = useMemo(() => {
    if (!annotation.filter) {
      return PanelFilterType.AllPanels;
    }
    return annotation.filter.exclude ? PanelFilterType.ExcludePanels : PanelFilterType.IncludePanels;
  }, [annotation.filter]);

  const { value: ds } = useAsync(() => {
    return getDataSourceSrv().get(annotation.datasource);
  }, [annotation.datasource]);

  const dsi = getDataSourceSrv().getInstanceSettings(annotation.datasource);

  const onNameChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    onUpdate(
      {
        ...annotation,
        name: ev.currentTarget.value,
      },
      editIndex
    );
  };

  const onDataSourceChange = (ds: DataSourceInstanceSettings) => {
    const dsRef = getDataSourceRef(ds);

    if (annotation.datasource?.type !== dsRef.type) {
      onUpdate(
        {
          datasource: dsRef,
          builtIn: annotation.builtIn,
          enable: annotation.enable,
          iconColor: annotation.iconColor,
          name: annotation.name,
          hide: annotation.hide,
          filter: annotation.filter,
          mappings: annotation.mappings,
          type: annotation.type,
        },
        editIndex
      );
    } else {
      onUpdate(
        {
          ...annotation,
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
        ...annotation,
        [target.name]: target.type === 'checkbox' ? target.checked : target.value,
      },
      editIndex
    );
  };

  const onColorChange = (color?: string) => {
    onUpdate(
      {
        ...annotation,
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
            ids: annotation.filter?.ids ?? [],
          };
    onUpdate({ ...annotation, filter }, editIndex);
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
    onUpdate({ ...annotation, filter }, editIndex);
  };

  const onDeleteAndLeavePage = () => {
    onDelete(editIndex);
    onBackToList();
  };

  const isNewAnnotation = annotation.name === newAnnotationName;

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
        <Field label={t('dashboard-scene.annotation-settings-edit.label-name', 'Name')}>
          <Input
            data-testid={selectors.pages.Dashboard.Settings.Annotations.Settings.name}
            name="name"
            id="name"
            autoFocus={isNewAnnotation}
            value={annotation.name}
            onChange={onNameChange}
          />
        </Field>
        <Field
          label={t('dashboard-scene.annotation-settings-edit.label-data-source', 'Data source')}
          htmlFor="data-source-picker"
        >
          <DataSourcePicker annotations variables current={annotation.datasource} onChange={onDataSourceChange} />
        </Field>
        {!ds?.meta.annotations && (
          <Alert
            title={t(
              'dashboard-scene.annotation-settings-edit.title-annotation-support-source',
              'No annotation support for this data source'
            )}
            severity="error"
          >
            <Trans i18nKey="errors.dashboard-settings.annotations.datasource">
              The selected data source does not support annotations. Please select a different data source.
            </Trans>
          </Alert>
        )}
        <Field
          label={t('dashboard-scene.annotation-settings-edit.label-enabled', 'Enabled')}
          description={t(
            'dashboard-scene.annotation-settings-edit.description-enabled-annotation-query-issued-every-dashboard',
            'When enabled the annotation query is issued every dashboard refresh'
          )}
        >
          <Checkbox
            name="enable"
            id="enable"
            value={annotation.enable}
            onChange={onChange}
            data-testid={selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.enable}
          />
        </Field>
        <Field
          label={t('dashboard-scene.annotation-settings-edit.label-hidden', 'Hidden')}
          description={t(
            'dashboard-scene.annotation-settings-edit.description-hidden',
            'Annotation queries can be toggled on or off at the top of the dashboard. With this option checked this toggle will be hidden.'
          )}
        >
          <Checkbox
            name="hide"
            id="hide"
            value={annotation.hide}
            onChange={onChange}
            data-testid={selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.hide}
          />
        </Field>
        <Field
          label={t('dashboard-scene.annotation-settings-edit.label-color', 'Color')}
          description={t(
            'dashboard-scene.annotation-settings-edit.description-color-annotation-event-markers',
            'Color to use for the annotation event markers'
          )}
        >
          <Stack>
            <ColorValueEditor value={annotation?.iconColor} onChange={onColorChange} />
          </Stack>
        </Field>
        <Field
          label={t('dashboard-scene.annotation-settings-edit.label-show-in', 'Show in')}
          data-testid={selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.showInLabel}
        >
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
                value={selectablePanels.filter((panel) => annotation.filter?.ids.includes(panel.value!))}
                onChange={onAddFilterPanelID}
                isClearable={true}
                placeholder={t('dashboard-scene.annotation-settings-edit.placeholder-choose-panels', 'Choose panels')}
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
        <h3 className="page-heading">
          <Trans i18nKey="dashboard-scene.annotation-settings-edit.query">Query</Trans>
        </h3>
        {ds?.annotations && dsi && (
          <StandardAnnotationQueryEditor
            datasource={ds}
            datasourceInstanceSettings={dsi}
            annotation={annotation}
            onChange={(annotation) => onUpdate(annotation, editIndex)}
          />
        )}
      </FieldSet>
      <Stack>
        {!annotation.builtIn && (
          <Button
            variant="destructive"
            onClick={onDeleteAndLeavePage}
            data-testid={selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.delete}
          >
            <Trans i18nKey="dashboard-scene.annotation-settings-edit.delete">Delete</Trans>
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={onBackToList}
          data-testid={selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.apply}
        >
          <Trans i18nKey="dashboard-scene.annotation-settings-edit.back-to-list">Back to list</Trans>
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
