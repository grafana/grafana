import React from 'react';

import { reportInteraction, getAppEvents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { IconButton } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';
import { dispatch } from 'app/store/store';
import { ShowConfirmModalEvent } from 'app/types/events';

import ExploreRunQueryButton from '../../ExploreRunQueryButton';

interface ActionsCellProps {
  query?: DataQuery;
  rootDatasourceUid?: string;
}

const onDeleteQuery = () => {
  const performDelete = (queryId: string) => {
    //deleteHistoryItem(queryId);
    dispatch(notifyApp(createSuccessNotification(t('explore.query-library.query-deleted', 'Query deleted'))));
    reportInteraction('grafana_explore_query_library_deleted');
  };

  getAppEvents().publish(
    new ShowConfirmModalEvent({
      title: t('explore.rich-history-card.delete-query-confirmation-title', 'Delete'),
      text: t(
        'explore.rich-history-card.delete-starred-query-confirmation-text',
        'Are you sure you want to permanently delete your starred query?'
      ),
      yesText: t('explore.rich-history-card.confirm-delete', 'Delete'),
      icon: 'trash-alt',
      onConfirm: () => performDelete(query),
    })
  );
};

function ActionsCell({ query, rootDatasourceUid }: ActionsCellProps) {
  return (
    <div>
      <IconButton
        name="trash-alt"
        title={t('explore.query-library.delete-query', 'Delete query')}
        tooltip={t('explore.query-library.delete-query', 'Delete query')}
        onClick={onDeleteQuery}
      />
      <ExploreRunQueryButton queries={query ? [query] : []} rootDatasourceUid={rootDatasourceUid} />;
    </div>
  );
}

export default ActionsCell;
