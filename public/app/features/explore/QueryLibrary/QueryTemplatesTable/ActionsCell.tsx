import { useState } from 'react';

import { getAppEvents } from '@grafana/runtime';
import { IconButton, Modal } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';
import { useDeleteQueryTemplateMutation } from 'app/features/query-library';
import { dispatch } from 'app/store/store';
import { ShowConfirmModalEvent } from 'app/types/events';

import {
  queryLibaryTrackDeleteQuery,
  queryLibraryTrackAddOrEditDescription,
  queryLibraryTrackRunQuery,
} from '../QueryLibraryAnalyticsEvents';
import { QueryTemplateForm } from '../QueryTemplateForm';
import { QueryActionButton } from '../types';

import { useQueryLibraryListStyles } from './styles';
import { QueryTemplateRow } from './types';

interface ActionsCellProps {
  queryUid?: string;
  queryTemplate: QueryTemplateRow;
  rootDatasourceUid?: string;
  QueryActionButton?: QueryActionButton;
}

function ActionsCell({ queryTemplate, rootDatasourceUid, queryUid, QueryActionButton }: ActionsCellProps) {
  const [deleteQueryTemplate] = useDeleteQueryTemplateMutation();
  const [editFormOpen, setEditFormOpen] = useState(false);
  const styles = useQueryLibraryListStyles();

  const onDeleteQuery = (queryUid: string) => {
    const performDelete = (queryUid: string) => {
      deleteQueryTemplate({
        name: queryUid,
        deleteOptions: {},
      });
      dispatch(notifyApp(createSuccessNotification(t('explore.query-library.query-deleted', 'Query deleted'))));
      queryLibaryTrackDeleteQuery();
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
        title={t('explore.query-library.add-edit-description', 'Add/edit description')}
        tooltip={t('explore.query-library.add-edit-description', 'Add/edit description')}
        onClick={() => {
          setEditFormOpen(true);
          queryLibraryTrackAddOrEditDescription();
        }}
      />
      {QueryActionButton && (
        <QueryActionButton
          queries={queryTemplate.query ? [queryTemplate.query] : []}
          datasourceUid={rootDatasourceUid}
          onClick={() => {
            queryLibraryTrackRunQuery(queryTemplate.datasourceType || '');
          }}
        />
      )}
      <Modal
        title={t('explore.query-template-modal.edit-title', 'Edit query')}
        isOpen={editFormOpen}
        onDismiss={() => setEditFormOpen(false)}
      >
        <QueryTemplateForm
          onCancel={() => setEditFormOpen(false)}
          templateData={queryTemplate}
          onSave={() => {
            setEditFormOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

export default ActionsCell;
