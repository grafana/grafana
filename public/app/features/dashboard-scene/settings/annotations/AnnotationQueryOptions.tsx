import { useCallback, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { AppEvents, CoreApp, DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getAppEvents, getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Box, Button, ButtonGroup, Dropdown, Field, Menu, Modal, Stack } from '@grafana/ui';
import StandardAnnotationQueryEditor from 'app/features/annotations/components/StandardAnnotationQueryEditor';
import { updateAnnotationFromSavedQuery } from 'app/features/annotations/utils/savedQueryUtils';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { dashboardEditActions } from '../../edit-pane/shared';

import { AnnotationLayer } from './AnnotationEditableElement';

export function AnnotationQueryEditorButton({ layer }: { layer: AnnotationLayer }) {
  const { queryLibraryEnabled } = useQueryLibraryContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Box display={'flex'} direction={'column'} paddingBottom={1}>
        <ButtonGroup>
          <Button
            tooltip={t(
              'dashboard.edit-pane.annotation.open-query-editor-tooltip',
              'Open the query editor to configure the annotation query'
            )}
            onClick={() => setIsModalOpen(true)}
            size="sm"
            fullWidth
          >
            <Trans i18nKey="dashboard.edit-pane.annotation.open-query-editor">Open query editor</Trans>
          </Button>
          {queryLibraryEnabled && (
            <AnnotationQueryLibraryDropdown layer={layer} onQuerySelected={() => setIsModalOpen(true)} />
          )}
        </ButtonGroup>
      </Box>
      <Modal
        title={t('dashboard.edit-pane.annotation.query-editor-modal-title', 'Annotation Query')}
        isOpen={isModalOpen}
        onDismiss={() => setIsModalOpen(false)}
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
          <Button variant="secondary" fill="outline" onClick={() => setIsModalOpen(false)}>
            <Trans i18nKey="dashboard.edit-pane.annotation.query-editor-close">Close</Trans>
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
}

function AnnotationQueryLibraryDropdown({
  layer,
  onQuerySelected,
}: {
  layer: AnnotationLayer;
  onQuerySelected: () => void;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { openDrawer, closeDrawer } = useQueryLibraryContext();

  const { query } = layer.useState();
  const { value: datasource } = useAsync(() => {
    return getDataSourceSrv().get(query?.datasource);
  }, [query?.datasource]);

  const onSelectFromQueryLibrary = useCallback(() => {
    openDrawer({
      options: {
        context: CoreApp.Dashboard,
      },
      onSelectQuery: async (selectedQuery: DataQuery) => {
        try {
          const updatedQuery = await updateAnnotationFromSavedQuery(query, selectedQuery);
          layer.setState({ query: updatedQuery });
          layer.runLayer();
        } catch (error) {
          console.error('Failed to replace annotation query!', error);
          getAppEvents().publish({
            type: AppEvents.alertError.name,
            payload: ['Failed to create annotation query!', error instanceof Error ? error.message : error],
          });
          return;
        }
        closeDrawer();
        onQuerySelected();
      },
    });
  }, [closeDrawer, layer, onQuerySelected, openDrawer, query]);

  const menuOverlay = useMemo(
    () => (
      <Menu>
        <Menu.Item
          icon="book-open"
          label={t(
            'dashboard-scene.annotation-query-library-dropdown.menu-overlay.label-use-saved-query',
            'Use saved query'
          )}
          onClick={onSelectFromQueryLibrary}
        />
      </Menu>
    ),
    [onSelectFromQueryLibrary]
  );

  if (!datasource) {
    return null;
  }

  return (
    <Dropdown overlay={menuOverlay} placement="bottom-end" onVisibleChange={setIsDropdownOpen}>
      <Button
        aria-label={t('dashboard-scene.annotation-query-editor-button.aria-label-toggle-menu', 'Toggle menu')}
        icon={isDropdownOpen ? 'angle-up' : 'angle-down'}
        size="sm"
      />
    </Dropdown>
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
        description: t('dashboard.edit-pane.annotation.change-data-source', 'Change annotation data source'),
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
    <Field label={t('dashboard.edit-pane.annotation.data-source', 'Data source')} noMargin>
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
