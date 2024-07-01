import { useState } from 'react';

import { reportInteraction, getAppEvents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { IconButton, Modal } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';
import { useDeleteQueryTemplateMutation } from 'app/features/query-library';
import { dispatch } from 'app/store/store';
import { ShowConfirmModalEvent } from 'app/types/events';

import ExploreRunQueryButton from '../../ExploreRunQueryButton';
import { QueryTemplateForm } from '../QueryTemplateForm';

import { useQueryLibraryListStyles } from './styles';
import { QueryTemplateRow } from './types';

interface ActionsCellProps {
  queryUid?: string;
  queryTemplate: QueryTemplateRow;
  rootDatasourceUid?: string;
}

function ActionsCell({ queryTemplate, rootDatasourceUid, queryUid }: ActionsCellProps) {
  const [deleteQueryTemplate] = useDeleteQueryTemplateMutation();
  const [editFormOpen, setEditFormOpen] = useState(false);
  //const [editQueryTemplate] = useEditQueryTemplateMutation();
  const styles = useQueryLibraryListStyles();

  const onDeleteQuery = (queryUid: string) => {
    const performDelete = (queryUid: string) => {
      deleteQueryTemplate({ uid: queryUid });
      dispatch(notifyApp(createSuccessNotification(t('explore.query-library.query-deleted', 'Query deleted'))));
      reportInteraction('grafana_explore_query_library_deleted');
    };

    getAppEvents().publish(
      new ShowConfirmModalEvent({
        title: t('explore.query-library.delete-query-title', 'Delete query'),
        text: t(
          'explore.query-library.delete-query-text',
          "You're about to remove this query from the query library. This action cannot be undone. Do you want to continue?"
        ),
        yesText: t('query-library.delete-query-button', 'Delete query'),
        icon: 'trash-alt',
        onConfirm: () => performDelete(queryUid),
      })
    );
  };

  return (
    <div className={styles.cell}>
      <IconButton
        className={styles.actionButton}
        size="lg"
        name="trash-alt"
        title={t('explore.query-library.delete-query', 'Delete query')}
        tooltip={t('explore.query-library.delete-query', 'Delete query')}
        onClick={() => {
          if (queryUid) {
            onDeleteQuery(queryUid);
          }
        }}
      />
      <IconButton
        className={styles.actionButton}
        size="lg"
        name="comment-alt"
        title={t('explore.query-library.delete-query', 'Add/edit description')}
        tooltip={t('explore.query-library.delete-query', 'Add/edit description')}
        onClick={() => {
          setEditFormOpen(true);
        }}
      />
      <ExploreRunQueryButton
        queries={queryTemplate.query ? [queryTemplate.query] : []}
        rootDatasourceUid={rootDatasourceUid}
      />
      <Modal
        title={t('explore.add-to-library-modal.title', 'Add query to Query Library')}
        isOpen={editFormOpen}
        onDismiss={() => setEditFormOpen(false)}
      >
        <QueryTemplateForm
          onCancel={() => setEditFormOpen(false)}
          templateData={queryTemplate}
          onSave={(data) => {
            console.log(data);
          }}
        />
      </Modal>
    </div>
  );
}

export default ActionsCell;
