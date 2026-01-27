import { css } from '@emotion/css';
import { useCallback, useId, useMemo } from 'react';

import { AnnotationQuery, getDataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneDataLayerProvider, SceneObject } from '@grafana/scenes';
import { Box, Button, Stack, Text, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { getDashboardSceneFor } from '../../utils/utils';

import { newAnnotationName } from './AnnotationSettingsEdit';

function useEditPaneOptions(
  this: AnnotationSetEditableElement,
  dataLayerSet: DashboardDataLayerSet
): OptionsPaneCategoryDescriptor[] {
  const annotationListId = useId();

  const options = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: 'annotations' }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: annotationListId,
        skipField: true,
        render: () => <AnnotationList dataLayerSet={dataLayerSet} />,
      })
    );
  }, [annotationListId, dataLayerSet]);

  return [options];
}

export class AnnotationSetEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(private dataLayerSet: DashboardDataLayerSet) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.annotation-set', 'Annotations & Alerts'),
      icon: 'comment-alt',
      instanceName: t('dashboard.edit-pane.elements.annotation-set', 'Annotations & Alerts'),
      isHidden: this.dataLayerSet.state.annotationLayers.length === 0,
    };
  }

  public getOutlineChildren(): SceneObject[] {
    return this.dataLayerSet.state.annotationLayers;
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.dataLayerSet);
}

function AnnotationList({ dataLayerSet }: { dataLayerSet: DashboardDataLayerSet }) {
  const { annotationLayers } = dataLayerSet.useState();
  const styles = useStyles2(getStyles);
  const canAdd = dataLayerSet.parent instanceof DashboardScene;

  const onSelectAnnotation = useCallback(
    (layer: SceneDataLayerProvider) => {
      const { editPane } = getDashboardSceneFor(dataLayerSet).state;
      editPane.selectObject(layer, layer.state.key!);
    },
    [dataLayerSet]
  );

  const onAddAnnotation = useCallback(() => {
    const defaultDatasource = getDataSourceSrv().getInstanceSettings(null);
    const datasourceRef =
      defaultDatasource?.meta.annotations ? getDataSourceRef(defaultDatasource) : undefined;

    const newAnnotationQuery: AnnotationQuery = {
      name: newAnnotationName,
      enable: true,
      datasource: datasourceRef,
      iconColor: 'red',
    };

    const newAnnotation = new DashboardAnnotationsDataLayer({
      query: newAnnotationQuery,
      name: newAnnotationQuery.name,
      isEnabled: Boolean(newAnnotationQuery.enable),
      isHidden: Boolean(newAnnotationQuery.hide),
    });

    dataLayerSet.addAnnotationLayer(newAnnotation);

    // Select the newly added annotation
    const { editPane } = getDashboardSceneFor(dataLayerSet).state;
    editPane.selectObject(newAnnotation, newAnnotation.state.key!);
  }, [dataLayerSet]);

  return (
    <Stack direction="column" gap={0}>
      {annotationLayers.map((layer) => (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events
        <div className={styles.annotationItem} key={layer.state.key} onClick={() => onSelectAnnotation(layer)}>
          <Text truncate>{layer.state.name}</Text>
          <Stack direction="row" gap={1} alignItems="center">
            <Button variant="primary" size="sm" fill="outline">
              <Trans i18nKey="dashboard.edit-pane.annotations.select-annotation">Select</Trans>
            </Button>
          </Stack>
        </div>
      ))}
      {canAdd && (
        <Box paddingBottom={1} display={'flex'}>
          <Button fullWidth icon="plus" size="sm" variant="secondary" onClick={onAddAnnotation}>
            <Trans i18nKey="dashboard.edit-pane.annotations.add-annotation">Add annotation</Trans>
          </Button>
        </Box>
      )}
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    annotationItem: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['color'], {
          duration: theme.transitions.duration.short,
        }),
      },
      '&:last-child': {
        marginBottom: theme.spacing(2),
      },
      button: {
        visibility: 'hidden',
      },
      '&:hover': {
        color: theme.colors.text.link,
        button: {
          visibility: 'visible',
        },
      },
    }),
  };
}
