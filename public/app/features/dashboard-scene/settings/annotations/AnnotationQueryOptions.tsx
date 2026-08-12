import { useCallback, useState } from 'react';
import { useAsync } from 'react-use';

import { AppEvents } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getAppEvents, getDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { Box, Button, ButtonGroup } from '@grafana/ui';
import { updateAnnotationFromSavedQuery } from 'app/features/annotations/utils/savedQueryUtils';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { type AnnotationLayer } from './AnnotationEditableElement';
import { AnnotationQueryEditorModal } from './AnnotationQueryEditorModal';

export function AnnotationQueryEditorButton({ layer }: { layer: AnnotationLayer }) {
  const { queryLibraryEnabled } = useQueryLibraryContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Box display={'flex'} direction={'column'} paddingBottom={1}>
        <ButtonGroup>
          <Button
            tooltip={t(
              'dashboard.sidebar.annotation.open-query-editor-tooltip',
              'Open the query editor to configure the annotation query'
            )}
            onClick={() => setIsModalOpen(true)}
            size="sm"
            fullWidth
          >
            <Trans i18nKey="dashboard.sidebar.annotation.open-query-editor">Open query editor</Trans>
          </Button>
          {queryLibraryEnabled && <QueryLibraryButton layer={layer} />}
        </ButtonGroup>
      </Box>
      {isModalOpen && <AnnotationQueryEditorModal layer={layer} onClose={() => setIsModalOpen(false)} />}
    </>
  );
}

function QueryLibraryButton({ layer, onQuerySelected }: { layer: AnnotationLayer; onQuerySelected?: () => void }) {
  const { openDrawer, closeDrawer } = useQueryLibraryContext();

  const { query } = layer.useState();
  const { value: datasource } = useAsync(() => {
    return getDataSourceSrv().get(query?.datasource);
  }, [query?.datasource]);

  const onSelectFromQueryLibrary = useCallback(() => {
    openDrawer({
      options: {
        context: 'dashboard-annotations',
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
        onQuerySelected?.();
      },
    });
  }, [closeDrawer, layer, onQuerySelected, openDrawer, query]);

  if (!datasource) {
    return null;
  }

  return (
    <Button variant="secondary" tooltip="" onClick={onSelectFromQueryLibrary} size="sm" fullWidth>
      <Trans i18nKey="dashboard-scene.annotation-query-library-dropdown.use-saved-query">Use saved query</Trans>
    </Button>
  );
}
