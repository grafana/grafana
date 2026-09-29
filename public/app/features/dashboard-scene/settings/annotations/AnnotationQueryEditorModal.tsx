import { useCallback, useRef } from 'react';

import { type DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useDataSourceInstance, useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { Button, Field, Modal, Stack } from '@grafana/ui';
import StandardAnnotationQueryEditor from 'app/features/annotations/components/StandardAnnotationQueryEditor';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { edit } from '../../actions/utils/edit';

import { type AnnotationLayer } from './AnnotationEditableElement';
import { annotationQueryWithDisplay, isAnnotationLabelHidden } from './annotationDisplay';

export function AnnotationQueryEditorModal({ layer, onClose }: { layer: AnnotationLayer; onClose: () => void }) {
  const queryOnOpen = useRef(layer.state.query);

  // Changes apply to the layer live and are committed as one edit on close.
  // Committing publishes DashboardStateChangedEvent, which rebuilds repeated rows/tabs from the source;
  // doing that mid-edit would unmount a modal opened from a repeat clone's controls.
  const onCloseAndCommit = useCallback(() => {
    const oldQuery = queryOnOpen.current;
    const newQuery = layer.state.query;

    if (newQuery !== oldQuery) {
      edit({
        description: t('dashboard.sidebar.annotation.change-query', 'Change annotation query'),
        source: layer,
        perform: () => {
          layer.setState({ query: newQuery });
          layer.runLayer();
        },
        undo: () => {
          layer.setState({ query: oldQuery });
          layer.runLayer();
        },
      });
    }

    onClose();
  }, [layer, onClose]);

  return (
    <Modal
      title={t('dashboard.sidebar.annotation.query-editor-modal-title', 'Annotation Query')}
      isOpen={true}
      onDismiss={onCloseAndCommit}
    >
      <Stack direction="column" gap={2}>
        <div>
          <AnnotationDataSourcePicker layer={layer} />
        </div>
        <div>
          <AnnotationQueryEditor layer={layer} />
        </div>
      </Stack>
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onCloseAndCommit}>
          <Trans i18nKey="dashboard.sidebar.annotation.query-editor-close">Close</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

function AnnotationDataSourcePicker({ layer }: { layer: AnnotationLayer }) {
  const { query } = layer.useState();

  const onDataSourceChange = useCallback(
    (ds: DataSourceInstanceSettings) => {
      const dsRef = getDataSourceRef(ds);

      let newQuery: typeof query = { ...query, datasource: dsRef };

      // If the data source type changed, reset the query to defaults but keep how its control is displayed
      if (query.datasource?.type !== dsRef.type) {
        const resetQuery: typeof query = {
          datasource: dsRef,
          builtIn: query.builtIn,
          enable: query.enable,
          iconColor: query.iconColor,
          name: query.name,
          filter: query.filter,
          mappings: query.mappings,
          type: query.type,
        };
        newQuery = annotationQueryWithDisplay(resetQuery, {
          isHidden: Boolean(query.hide),
          placement: query.placement,
          hideLabel: isAnnotationLabelHidden(query),
        });
      }

      layer.setState({ query: newQuery });
      layer.runLayer();
    },
    [layer, query]
  );

  return (
    <Field label={t('dashboard.sidebar.annotation.data-source', 'Data source')} noMargin>
      <DataSourcePicker annotations variables current={query?.datasource} onChange={onDataSourceChange} />
    </Field>
  );
}

function AnnotationQueryEditor({ layer }: { layer: AnnotationLayer }) {
  const { query } = layer.useState();
  const { dataSource: ds } = useDataSourceInstance(query?.datasource);
  const { settings: dsi } = useDataSourceInstanceSettings(query?.datasource);

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
      disableSavedQueries
      datasource={ds}
      datasourceInstanceSettings={dsi}
      annotation={query}
      onChange={onChange}
    />
  );
}
