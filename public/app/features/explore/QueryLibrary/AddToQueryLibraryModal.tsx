import { DataQuery } from '@grafana/schema';
import { Modal } from '@grafana/ui';

import { t } from '../../../core/internationalization';

import { queryLibraryTrackAddFromQueryRow } from './QueryLibraryAnalyticsEvents';
import { QueryTemplateForm } from './QueryTemplateForm';

type Props = {
  isOpen: boolean;
  close: () => void;
  query?: DataQuery;
};

export function AddToQueryLibraryModal({ query, close, isOpen }: Props) {
  return (
    <Modal
      title={t('explore.query-template-modal.add-title', 'Add query to Query Library')}
      isOpen={isOpen}
      onDismiss={() => close()}
    >
      <QueryTemplateForm
        onCancel={() => {
          close();
        }}
        onSave={(isSuccess) => {
          if (isSuccess) {
            close();
            queryLibraryTrackAddFromQueryRow(query?.datasource?.type || '');
          }
        }}
        queryToAdd={query!}
      />
    </Modal>
  );
}
