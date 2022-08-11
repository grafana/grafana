import { css, cx } from '@emotion/css';
import React, { useState, useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme, DataSourceApi, DataQuery } from '@grafana/data';
import { config, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { stylesFactory, useTheme, TextArea, Button, IconButton } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import appEvents from 'app/core/app_events';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { copyStringToClipboard } from 'app/core/utils/explore';
import { createUrlFromRichHistory, createQueryText } from 'app/core/utils/richHistory';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { dispatch } from 'app/store/store';
import { StoreState } from 'app/types';
import { RichHistoryQuery, ExploreId } from 'app/types/explore';

import { ShowConfirmModalEvent } from '../../../types/events';
import { changeDatasource } from '../state/datasource';
import { starHistoryItem, commentHistoryItem, deleteHistoryItem } from '../state/history';
import { setQueries } from '../state/query';

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  const { datasourceInstance } = explore[exploreId]!;
  return {
    exploreId,
    datasourceInstance,
  };
}

const mapDispatchToProps = {
  changeDatasource,
  deleteHistoryItem,
  commentHistoryItem,
  starHistoryItem,
  setQueries,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps<T extends DataQuery = DataQuery> {
  query: RichHistoryQuery<T>;
  dsImg: string;
  isRemoved: boolean;
}

export type Props<T extends DataQuery = DataQuery> = ConnectedProps<typeof connector> & OwnProps<T>;

const getStyles = stylesFactory((theme: GrafanaTheme, isRemoved: boolean) => {
  /* Hard-coded value so all buttons and icons on right side of card are aligned */
  const rightColumnWidth = '240px';
  const rightColumnContentWidth = '170px';

  /* If datasource was removed, card will have inactive color */
  const cardColor = theme.colors.bg2;

  return {
    queryCard: css`
      display: flex;
      flex-direction: column;
      border: 1px solid ${theme.colors.border1};
      margin: ${theme.spacing.sm} 0;
      background-color: ${cardColor};
      border-radius: ${theme.border.radius.sm};
      .starred {
        color: ${theme.palette.orange};
      }
    `,
    cardRow: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.spacing.sm};
      border-bottom: none;
      :first-of-type {
        border-bottom: 1px solid ${theme.colors.border1};
        padding: ${theme.spacing.xs} ${theme.spacing.sm};
      }
      img {
        height: ${theme.typography.size.base};
        max-width: ${theme.typography.size.base};
        margin-right: ${theme.spacing.sm};
      }
    `,
    datasourceContainer: css`
      display: flex;
      align-items: center;
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.semibold};
    `,
    queryActionButtons: css`
      max-width: ${rightColumnContentWidth};
      display: flex;
      justify-content: flex-end;
      font-size: ${theme.typography.size.base};
      button {
        margin-left: ${theme.spacing.sm};
      }
    `,
    queryContainer: css`
      font-weight: ${theme.typography.weight.semibold};
      width: calc(100% - ${rightColumnWidth});
    `,
    queryRow: css`
      border-top: 1px solid ${theme.colors.border1};
      word-break: break-all;
      padding: 4px 2px;
      :first-child {
        border-top: none;
        padding: 0 0 4px 0;
      }
    `,
    updateCommentContainer: css`
      width: calc(100% + ${rightColumnWidth});
      margin-top: ${theme.spacing.sm};
    `,
    comment: css`
      overflow-wrap: break-word;
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.regular};
      margin-top: ${theme.spacing.xs};
    `,
    commentButtonRow: css`
      > * {
        margin-right: ${theme.spacing.sm};
      }
    `,
    textArea: css`
      width: 100%;
    `,
    runButton: css`
      max-width: ${rightColumnContentWidth};
      display: flex;
      justify-content: flex-end;
      button {
        height: auto;
        padding: ${theme.spacing.xs} ${theme.spacing.md};
        line-height: 1.4;
        span {
          white-space: normal !important;
        }
      }
    `,
  };
});

export function RichHistoryCard(props: Props) {
  const {
    query,
    dsImg,
    isRemoved,
    commentHistoryItem,
    starHistoryItem,
    deleteHistoryItem,
    changeDatasource,
    exploreId,
    datasourceInstance,
    setQueries,
  } = props;
  const [activeUpdateComment, setActiveUpdateComment] = useState(false);
  const [comment, setComment] = useState<string | undefined>(query.comment);
  const [queryDsInstance, setQueryDsInstance] = useState<DataSourceApi | undefined>(undefined);

  useEffect(() => {
    const getQueryDsInstance = async () => {
      const ds = await getDataSourceSrv().get(query.datasourceUid);
      setQueryDsInstance(ds);
    };

    getQueryDsInstance();
  }, [query.datasourceUid]);

  const theme = useTheme();
  const styles = getStyles(theme, isRemoved);

  const onRunQuery = async () => {
    const queriesToRun = query.queries;
    const differentDataSource = query.datasourceUid !== datasourceInstance?.uid;
    if (differentDataSource) {
      await changeDatasource(exploreId, query.datasourceUid, { importQueries: true });
      setQueries(exploreId, queriesToRun);
    } else {
      setQueries(exploreId, queriesToRun);
    }
    reportInteraction('grafana_explore_query_history_run', {
      queryHistoryEnabled: config.queryHistoryEnabled,
      differentDataSource,
    });
  };

  const onCopyQuery = () => {
    const queriesToCopy = query.queries.map((q) => createQueryText(q, queryDsInstance)).join('\n');
    copyStringToClipboard(queriesToCopy);
    dispatch(notifyApp(createSuccessNotification('Query copied to clipboard')));
  };

  const onCreateShortLink = async () => {
    const link = createUrlFromRichHistory(query);
    await createAndCopyShortLink(link);
  };

  const onDeleteQuery = () => {
    const performDelete = (queryId: string) => {
      deleteHistoryItem(queryId);
      dispatch(notifyApp(createSuccessNotification('Query deleted')));
      reportInteraction('grafana_explore_query_history_deleted', {
        queryHistoryEnabled: config.queryHistoryEnabled,
      });
    };

    // For starred queries, we want confirmation. For non-starred, we don't.
    if (query.starred) {
      appEvents.publish(
        new ShowConfirmModalEvent({
          title: 'Delete',
          text: 'Are you sure you want to permanently delete your starred query?',
          yesText: 'Delete',
          icon: 'trash-alt',
          onConfirm: () => performDelete(query.id),
        })
      );
    } else {
      performDelete(query.id);
    }
  };

  const onStarrQuery = () => {
    starHistoryItem(query.id, !query.starred);
    reportInteraction('grafana_explore_query_history_starred', {
      queryHistoryEnabled: config.queryHistoryEnabled,
      newValue: !query.starred,
    });
  };

  const toggleActiveUpdateComment = () => setActiveUpdateComment(!activeUpdateComment);

  const onUpdateComment = () => {
    commentHistoryItem(query.id, comment);
    setActiveUpdateComment(false);
    reportInteraction('grafana_explore_query_history_commented', {
      queryHistoryEnabled: config.queryHistoryEnabled,
    });
  };

  const onCancelUpdateComment = () => {
    setActiveUpdateComment(false);
    setComment(query.comment);
  };

  const onKeyDown = (keyEvent: React.KeyboardEvent) => {
    if (keyEvent.key === 'Enter' && (keyEvent.shiftKey || keyEvent.ctrlKey)) {
      onUpdateComment();
    }

    if (keyEvent.key === 'Escape') {
      onCancelUpdateComment();
    }
  };

  const updateComment = (
    <div className={styles.updateCommentContainer} aria-label={comment ? 'Update comment form' : 'Add comment form'}>
      <TextArea
        value={comment}
        placeholder={comment ? undefined : 'An optional description of what the query does.'}
        onChange={(e) => setComment(e.currentTarget.value)}
        className={styles.textArea}
      />
      <div className={styles.commentButtonRow}>
        <Button onClick={onUpdateComment} aria-label="Submit button">
          Save comment
        </Button>
        <Button variant="secondary" onClick={onCancelUpdateComment}>
          Cancel
        </Button>
      </div>
    </div>
  );

  const queryActionButtons = (
    <div className={styles.queryActionButtons}>
      <IconButton
        name="comment-alt"
        onClick={toggleActiveUpdateComment}
        title={query.comment?.length > 0 ? 'Edit comment' : 'Add comment'}
      />
      <IconButton name="copy" onClick={onCopyQuery} title="Copy query to clipboard" />
      {!isRemoved && (
        <IconButton name="share-alt" onClick={onCreateShortLink} title="Copy shortened link to clipboard" />
      )}
      <IconButton name="trash-alt" title={'Delete query'} onClick={onDeleteQuery} />
      <IconButton
        name={query.starred ? 'favorite' : 'star'}
        iconType={query.starred ? 'mono' : 'default'}
        onClick={onStarrQuery}
        title={query.starred ? 'Unstar query' : 'Star query'}
      />
    </div>
  );

  return (
    <div className={styles.queryCard} onKeyDown={onKeyDown}>
      <div className={styles.cardRow}>
        <div className={styles.datasourceContainer}>
          <img src={dsImg} aria-label="Data source icon" />
          <div aria-label="Data source name">
            {isRemoved ? 'Data source does not exist anymore' : query.datasourceName}
          </div>
        </div>
        {queryActionButtons}
      </div>
      <div className={cx(styles.cardRow)}>
        <div className={styles.queryContainer}>
          {query.queries.map((q, i) => {
            const queryText = createQueryText(q, queryDsInstance);
            return (
              <div aria-label="Query text" key={`${q}-${i}`} className={styles.queryRow}>
                {queryText}
              </div>
            );
          })}
          {!activeUpdateComment && query.comment && (
            <div aria-label="Query comment" className={styles.comment}>
              {query.comment}
            </div>
          )}
          {activeUpdateComment && updateComment}
        </div>
        {!activeUpdateComment && (
          <div className={styles.runButton}>
            <Button variant="secondary" onClick={onRunQuery} disabled={isRemoved}>
              {datasourceInstance?.uid === query.datasourceUid ? 'Run query' : 'Switch data source and run query'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default connector(RichHistoryCard);
