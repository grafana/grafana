import { useCallback } from 'react';
import { useAsync } from 'react-use';

import { type DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Button, Field, Modal, Stack } from '@grafana/ui';
import StandardAnnotationQueryEditor from 'app/features/annotations/components/StandardAnnotationQueryEditor';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { dashboardEditActions } from '../../sidebar/shared';

import { type AnnotationLayer } from './AnnotationEditableElement';

export function AnnotationQueryEditorModal({ layer, onClose }: { layer: AnnotationLayer; onClose: () => void }) {
  return (
    <Modal
      title={t('dashboard.sidebar.annotation.query-editor-modal-title', 'Annotation Query')}
      isOpen={true}
      onDismiss={onClose}
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
        <Button variant="secondary" fill="outline" onClick={onClose}>
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

      dashboardEditActions.edit({
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
      disableSavedQueries
      datasource={ds}
      datasourceInstanceSettings={dsi}
      annotation={query}
      onChange={onChange}
    />
  );
}
