import { useCallback, useEffect, useRef } from 'react';

import { type DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useDataSourceInstance, useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { Button, Field, Modal, Stack } from '@grafana/ui';
import StandardAnnotationQueryEditor from 'app/features/annotations/components/StandardAnnotationQueryEditor';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { edit } from '../../actions/utils/edit';

import { type AnnotationLayer } from './AnnotationEditableElement';
import { annotationEditActions } from './actions';

export function AnnotationQueryEditorModal({ layer, onClose }: { layer: AnnotationLayer; onClose: () => void }) {
  // The query editor applies changes live, they are recorded as a single change when the modal closes
  const committedQuery = useRef(layer.state.query);

  const commitQueryEditorChanges = useCallback(() => {
    annotationEditActions.changeAnnotationQuery({
      source: layer,
      oldValue: committedQuery.current,
      newValue: layer.state.query,
      scope: 'query-editor',
    });
    committedQuery.current = layer.state.query;
  }, [layer]);

  const onDataSourceChanged = useCallback(() => {
    committedQuery.current = layer.state.query;
  }, [layer]);

  // The editor adjusts the query structure for its data source, that is not a user change
  const onQueryPrepared = useCallback(() => {
    committedQuery.current = layer.state.query;
  }, [layer]);

  const onCloseModal = () => {
    commitQueryEditorChanges();
    onClose();
  };

  return (
    <Modal
      title={t('dashboard.sidebar.annotation.query-editor-modal-title', 'Annotation Query')}
      isOpen={true}
      onDismiss={onCloseModal}
    >
      <Stack direction="column" gap={2}>
        <div>
          <AnnotationDataSourcePicker
            layer={layer}
            onBeforeChange={commitQueryEditorChanges}
            onAfterChange={onDataSourceChanged}
          />
        </div>
        <div>
          <AnnotationQueryEditor layer={layer} onQueryPrepared={onQueryPrepared} />
        </div>
      </Stack>
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onCloseModal}>
          <Trans i18nKey="dashboard.sidebar.annotation.query-editor-close">Close</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

interface AnnotationDataSourcePickerProps {
  layer: AnnotationLayer;
  onBeforeChange: () => void;
  onAfterChange: () => void;
}

function AnnotationDataSourcePicker({ layer, onBeforeChange, onAfterChange }: AnnotationDataSourcePickerProps) {
  const { query } = layer.useState();

  const onDataSourceChange = useCallback(
    (ds: DataSourceInstanceSettings) => {
      const dsRef = getDataSourceRef(ds);
      const oldQuery = query;

      // If the data source type changed, reset the query to defaults
      const newQuery =
        query.datasource?.type !== dsRef.type
          ? {
              datasource: dsRef,
              builtIn: query.builtIn,
              enable: query.enable,
              iconColor: query.iconColor,
              name: query.name,
              hide: query.hide,
              filter: query.filter,
              mappings: query.mappings,
              type: query.type,
            }
          : { ...query, datasource: dsRef };

      onBeforeChange();
      edit({
        meta: { actionId: 'annotation.changeDataSource' },
        description: t('dashboard.sidebar.annotation.change-data-source', 'Change annotation data source'),
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
      onAfterChange();
    },
    [layer, query, onBeforeChange, onAfterChange]
  );

  return (
    <Field label={t('dashboard.sidebar.annotation.data-source', 'Data source')} noMargin>
      <DataSourcePicker annotations variables current={query?.datasource} onChange={onDataSourceChange} />
    </Field>
  );
}

interface AnnotationQueryEditorProps {
  layer: AnnotationLayer;
  onQueryPrepared: () => void;
}

function AnnotationQueryEditor({ layer, onQueryPrepared }: AnnotationQueryEditorProps) {
  const { query } = layer.useState();
  const { dataSource: ds } = useDataSourceInstance(query?.datasource);
  const { settings: dsi } = useDataSourceInstanceSettings(query?.datasource);
  const isEditorShown = Boolean(ds?.annotations && dsi && query);

  // The editor prepares the query in its effect when it is shown for a data source. That effect runs
  // before the one below, so a change made while this is set comes from the preparation.
  const preparedDataSourceUid = useRef<string | null | undefined>(null);
  const isPreparingQuery = useRef(false);
  if (isEditorShown && ds?.uid !== preparedDataSourceUid.current) {
    isPreparingQuery.current = true;
  }

  useEffect(() => {
    if (isEditorShown) {
      preparedDataSourceUid.current = ds?.uid;
      isPreparingQuery.current = false;
    }
  }, [ds?.uid, isEditorShown]);

  const onChange = useCallback(
    (newQuery: typeof query) => {
      layer.setState({ query: newQuery });
      layer.runLayer();
      if (isPreparingQuery.current) {
        onQueryPrepared();
      }
    },
    [layer, onQueryPrepared]
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
