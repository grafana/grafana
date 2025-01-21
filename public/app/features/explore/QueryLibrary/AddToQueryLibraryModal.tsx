import { Modal } from '@grafana/ui';

import { t } from '../../../core/internationalization';

import { queryLibraryTrackAddFromQueryRow } from './QueryLibraryAnalyticsEvents';
import { useQueryLibraryContext } from './QueryLibraryContext';
import { QueryTemplateForm } from './QueryTemplateForm';

export function AddToQueryLibraryModal() {
  const { addQueryModalOpened, closeAddQueryModal, activeQuery } = useQueryLibraryContext();

  return (
    <Modal
      title={t('explore.query-template-modal.add-title', 'Add query to Query Library')}
      isOpen={addQueryModalOpened}
      onDismiss={() => closeAddQueryModal()}
    >
      <QueryTemplateForm
        onCancel={() => {
          closeAddQueryModal();
        }}
        onSave={(isSuccess) => {
          if (isSuccess) {
            closeAddQueryModal();
            queryLibraryTrackAddFromQueryRow(activeQuery?.datasource?.type || '');
          }
        }}
        queryToAdd={activeQuery!}
      />
    </Modal>
  );
}
