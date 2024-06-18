import React from 'react';

import { reportInteraction, getAppEvents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { IconButton } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';
import { useDeleteQueryTemplateMutation } from 'app/features/query-library';
import { dispatch } from 'app/store/store';
import { ShowConfirmModalEvent } from 'app/types/events';

import ExploreRunQueryButton from '../../ExploreRunQueryButton';

import { useQueryLibraryListStyles } from './styles';

interface ActionsCellProps {
  queryUid?: string;
  query?: DataQuery;
  rootDatasourceUid?: string;
}

function ActionsCell({ query, rootDatasourceUid, queryUid }: ActionsCellProps) {
  const [deleteQueryTemplate] = useDeleteQueryTemplateMutation();
  const styles = useQueryLibraryListStyles();

  const onDeleteQuery = (queryUid: string) => {
    const performDelete = (queryUid: string) => {
      deleteQueryTemplate({ uid: queryUid });
      dispatch(notifyApp(createSuccessNotification(t('explore.query-library.query-deleted', 'Query deleted'))));
      reportInteraction('grafana_explore_query_library_deleted');
    };

    getAppEvents().publish(
      new ShowConfirmModalEvent({
        title: t('explore.query-library.delete-query-title', 'Delete'),
        text: t(
          'explore.query-library.delete-query-text',
          'Are you sure you want to permanently delete your query from the query library?'
        ),
        yesText: t('query-library.delete-query-button', 'Delete'),
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
      <ExploreRunQueryButton queries={query ? [query] : []} rootDatasourceUid={rootDatasourceUid} />
    </div>
  );
}

export default ActionsCell;
