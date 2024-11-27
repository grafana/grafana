import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
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
import { getDataSourceSrv, locationService } from '@grafana/runtime';
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
  Alert,
} from '@grafana/ui';
import { ColorValueEditor } from 'app/core/components/OptionsUI/color';
import config from 'app/core/config';
import { Trans } from 'app/core/internationalization';
import StandardAnnotationQueryEditor from 'app/features/annotations/components/StandardAnnotationQueryEditor';
import { AngularEditorLoader } from 'app/features/dashboard-scene/settings/annotations/AngularEditorLoader';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { DashboardModel } from '../../state/DashboardModel';

type Props = {
  editIdx: number;
  dashboard: DashboardModel;
};

export const newAnnotationName = 'New annotation';

export const AnnotationSettingsEdit = ({ editIdx, dashboard }: Props) => {
  const styles = useStyles2(getStyles);
  const [annotation, setAnnotation] = useState(dashboard.annotations.list[editIdx]);

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

  const onUpdate = (annotation: AnnotationQuery) => {
    const list = [...dashboard.annotations.list];
    list.splice(editIdx, 1, annotation);
    setAnnotation(annotation);
    dashboard.annotations.list = list;
  };

  const onNameChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    onUpdate({
      ...annotation,
      name: ev.currentTarget.value,
    });
  };

  const onDataSourceChange = (ds: DataSourceInstanceSettings) => {
    const dsRef = getDataSourceRef(ds);

    if (annotation.datasource?.type !== dsRef.type) {
      onUpdate({
        datasource: dsRef,
        builtIn: annotation.builtIn,
        enable: annotation.enable,
        iconColor: annotation.iconColor,
        name: annotation.name,
        hide: annotation.hide,
        filter: annotation.filter,
        mappings: annotation.mappings,
        type: annotation.type,
      });
    } else {
      onUpdate({
        ...annotation,
        datasource: dsRef,
      });
    }
  };

  const onChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    const target = ev.currentTarget;
    onUpdate({
      ...annotation,
      [target.name]: target.type === 'checkbox' ? target.checked : target.value,
    });
  };

  const onColorChange = (color?: string) => {
    onUpdate({
      ...annotation,
      iconColor: color!,
    });
  };

  const onFilterTypeChange = (v: SelectableValue<PanelFilterType>) => {
    let filter =
      v.value === PanelFilterType.AllPanels
        ? undefined
        : {
            exclude: v.value === PanelFilterType.ExcludePanels,
            ids: annotation.filter?.ids ?? [],
          };
    onUpdate({ ...annotation, filter });
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
    onUpdate({ ...annotation, filter });
  };

  const onApply = goBackToList;

  const onPreview = () => {
    locationService.partial({ editview: null, editIndex: null });
  };

  const onDelete = () => {
    const annotations = dashboard.annotations.list;
    dashboard.annotations.list = [...annotations.slice(0, editIdx), ...annotations.slice(editIdx + 1)];
    goBackToList();
  };

  const isNewAnnotation = annotation.name === newAnnotationName;

  const sortFn = (a: SelectableValue<number>, b: SelectableValue<number>) => {
    if (a.label && b.label) {
      return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
    }

    return -1;
  };

  const panels: Array<SelectableValue<number>> = useMemo(
    () =>
      dashboard?.panels
        // Filtering out rows at the moment, revisit to only include panels that support annotations
        // However the information to know if a panel supports annotations requires it to be already loaded
        // panel.plugin?.dataSupport?.annotations
        .filter((panel) => config.panels[panel.type])
        .map((panel) => ({
          value: panel.id,
          label: panel.title ?? `Panel ${panel.id}`,
          description: panel.description,
          imgUrl: config.panels[panel.type].info.logos.small,
        }))
        .sort(sortFn) ?? [],
    [dashboard]
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
            value={annotation.name}
            onChange={onNameChange}
          />
        </Field>
        <Field label="Data source" htmlFor="data-source-picker">
          <DataSourcePicker annotations variables current={annotation.datasource} onChange={onDataSourceChange} />
        </Field>
        {!ds?.meta.annotations && (
          <Alert title="No annotation support for this data source" severity="error">
            <Trans i18nKey="errors.dashboard-settings.annotations.datasource">
              The selected data source does not support annotations. Please select a different data source.
            </Trans>
          </Alert>
        )}
        <Field label="Enabled" description="When enabled the annotation query is issued every dashboard refresh">
          <Checkbox name="enable" id="enable" value={annotation.enable} onChange={onChange} />
        </Field>
        <Field
          label="Hidden"
          description="Annotation queries can be toggled on or off at the top of the dashboard. With this option checked this toggle will be hidden."
        >
          <Checkbox name="hide" id="hide" value={annotation.hide} onChange={onChange} />
        </Field>
        <Field label="Color" description="Color to use for the annotation event markers">
          <HorizontalGroup>
            <ColorValueEditor value={annotation?.iconColor} onChange={onColorChange} />
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
                options={panels}
                value={panels.filter((panel) => annotation.filter?.ids.includes(panel.value!))}
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
            annotation={annotation}
            onChange={onUpdate}
          />
        )}
        {ds && !ds.annotations && <AngularEditorLoader datasource={ds} annotation={annotation} onChange={onUpdate} />}
      </FieldSet>
      <Stack>
        {!annotation.builtIn && (
          <Button variant="destructive" onClick={onDelete}>
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
        <Button variant="primary" onClick={onApply}>
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

function goBackToList() {
  locationService.partial({ editIndex: null });
}

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
