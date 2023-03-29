import { css, cx } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useAsync } from 'react-use';

import { GrafanaTheme2, DataSourceApi } from '@grafana/data';
import { config, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { TextArea, Button, IconButton, useStyles2, LoadingPlaceholder } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import appEvents from 'app/core/app_events';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { copyStringToClipboard } from 'app/core/utils/explore';
import { createUrlFromRichHistory, createQueryText } from 'app/core/utils/richHistory';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { changeDatasource } from 'app/features/explore/state/datasource';
import { starHistoryItem, commentHistoryItem, deleteHistoryItem } from 'app/features/explore/state/history';
import { setQueries } from 'app/features/explore/state/query';
import { dispatch } from 'app/store/store';
import { StoreState } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';
import { RichHistoryQuery, ExploreId } from 'app/types/explore';

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  const { datasourceInstance } = explore.panes[exploreId]!;
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
}

export type Props<T extends DataQuery = DataQuery> = ConnectedProps<typeof connector> & OwnProps<T>;

const getStyles = (theme: GrafanaTheme2) => {
  /* Hard-coded value so all buttons and icons on right side of card are aligned */
  const rightColumnWidth = '240px';
  const rightColumnContentWidth = '170px';

  /* If datasource was removed, card will have inactive color */
  const cardColor = theme.colors.background.secondary;

  return {
    queryCard: css`
      position: relative;
      display: flex;
      flex-direction: column;
      border: 1px solid ${theme.colors.border.weak};
      margin: ${theme.spacing(1)} 0;
      background-color: ${cardColor};
      border-radius: ${theme.shape.borderRadius(1)};
      .starred {
        color: ${theme.v1.palette.orange};
      }
    `,
    cardRow: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.spacing(1)};
      border-bottom: none;
      :first-of-type {
        border-bottom: 1px solid ${theme.colors.border.weak};
        padding: ${theme.spacing(0.5, 1)};
      }
      img {
        height: ${theme.typography.fontSize}px;
        max-width: ${theme.typography.fontSize}px;
        margin-right: ${theme.spacing(1)};
      }
    `,
    queryActionButtons: css`
      max-width: ${rightColumnContentWidth};
      display: flex;
      justify-content: flex-end;
      font-size: ${theme.typography.size.base};
      button {
        margin-left: ${theme.spacing(1)};
      }
    `,
    queryContainer: css`
      font-weight: ${theme.typography.fontWeightMedium};
      width: calc(100% - ${rightColumnWidth});
    `,
    updateCommentContainer: css`
      width: calc(100% + ${rightColumnWidth});
      margin-top: ${theme.spacing(1)};
    `,
    comment: css`
      overflow-wrap: break-word;
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightRegular};
      margin-top: ${theme.spacing(0.5)};
    `,
    commentButtonRow: css`
      > * {
        margin-right: ${theme.spacing(1)};
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
        padding: ${theme.spacing(0.5, 2)};
        line-height: 1.4;
        span {
          white-space: normal !important;
        }
      }
    `,
    loader: css`
      position: absolute;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: ${theme.colors.background.secondary};
    `,
  };
};

export function RichHistoryCard(props: Props) {
  const {
    query,
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
  const { value, loading } = useAsync(async () => {
    let dsInstance: DataSourceApi | undefined;
    try {
      dsInstance = await getDataSourceSrv().get(query.datasourceUid);
    } catch (e) {}

    return {
      dsInstance,
      queries: await Promise.all(
        query.queries.map(async (query) => {
          let datasource;
          if (dsInstance?.meta.mixed) {
            try {
              datasource = await getDataSourceSrv().get(query.datasource);
            } catch (e) {}
          } else {
            datasource = dsInstance;
          }

          return {
            query,
            datasource,
          };
        })
      ),
    };
  }, [query.datasourceUid, query.queries]);

  const styles = useStyles2(getStyles);

  const onRunQuery = async () => {
    const queriesToRun = query.queries;
    const differentDataSource = query.datasourceUid !== datasourceInstance?.uid;
    if (differentDataSource) {
      await changeDatasource(exploreId, query.datasourceUid);
    }
    setQueries(exploreId, queriesToRun);

    reportInteraction('grafana_explore_query_history_run', {
      queryHistoryEnabled: config.queryHistoryEnabled,
      differentDataSource,
    });
  };

  const onCopyQuery = async () => {
    const datasources = [...query.queries.map((q) => q.datasource?.type || 'unknown')];
    reportInteraction('grafana_explore_query_history_copy_query', {
      datasources,
      mixed: Boolean(value?.dsInstance?.meta.mixed),
    });

    if (loading || !value) {
      return;
    }

    const queriesText = value.queries
      .map((q) => {
        return createQueryText(q.query, q.datasource);
      })
      .join('\n');

    copyStringToClipboard(queriesText);
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
        onKeyDown={onKeyDown}
        value={comment}
        placeholder={comment ? undefined : 'An optional description of what the query does.'}
        onChange={(e) => setComment(e.currentTarget.value)}
        className={styles.textArea}
      />
      <div className={styles.commentButtonRow}>
        <Button onClick={onUpdateComment}>Save comment</Button>
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
      {value?.dsInstance && (
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
    <div className={styles.queryCard}>
      <div className={styles.cardRow}>
        <DatasourceInfo dsApi={value?.dsInstance} size="sm" />

        {queryActionButtons}
      </div>
      <div className={cx(styles.cardRow)}>
        <div className={styles.queryContainer}>
          {value?.queries.map((q, i) => {
            return <Query query={q} key={`${q}-${i}`} showDsInfo={value?.dsInstance?.meta.mixed} />;
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
            <Button
              variant="secondary"
              onClick={onRunQuery}
              disabled={!value?.dsInstance || value.queries.some((query) => !query.datasource)}
            >
              {datasourceInstance?.uid === query.datasourceUid ? 'Run query' : 'Switch data source and run query'}
            </Button>
          </div>
        )}
      </div>
      {loading && <LoadingPlaceholder text="loading..." className={styles.loader} />}
    </div>
  );
}

const getQueryStyles = (theme: GrafanaTheme2) => ({
  queryRow: css`
    border-top: 1px solid ${theme.colors.border.weak};
    display: flex;
    flex-direction: row;
    padding: 4px 0px;
    gap: 4px;
    :first-child {
      border-top: none;
    }
  `,
  dsInfoContainer: css`
    display: flex;
    align-items: center;
  `,
  queryText: css`
    word-break: break-all;
  `,
});

interface QueryProps {
  query: {
    query: DataQuery;
    datasource?: DataSourceApi;
  };
  /** Show datasource info (icon+name) alongside the query text */
  showDsInfo?: boolean;
}

const Query = ({ query, showDsInfo = false }: QueryProps) => {
  const styles = useStyles2(getQueryStyles);

  return (
    <div className={styles.queryRow}>
      {showDsInfo && (
        <div className={styles.dsInfoContainer}>
          <DatasourceInfo dsApi={query.datasource} size="md" />
          {': '}
        </div>
      )}
      <span aria-label="Query text" className={styles.queryText}>
        {createQueryText(query.query, query.datasource)}
      </span>
    </div>
  );
};

const getDsInfoStyles = (size: 'sm' | 'md') => (theme: GrafanaTheme2) =>
  css`
    display: flex;
    align-items: center;
    font-size: ${theme.typography[size === 'sm' ? 'bodySmall' : 'body'].fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
    white-space: nowrap;
  `;

function DatasourceInfo({ dsApi, size }: { dsApi?: DataSourceApi; size: 'sm' | 'md' }) {
  const getStyles = useCallback((theme: GrafanaTheme2) => getDsInfoStyles(size)(theme), [size]);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles}>
      <img
        src={dsApi?.meta.info.logos.small || 'public/img/icn-datasource.svg'}
        alt={dsApi?.type || 'Data source does not exist anymore'}
        aria-label="Data source icon"
      />
      <div aria-label="Data source name">{dsApi?.name || 'Data source does not exist anymore'}</div>
    </div>
  );
}

export default connector(RichHistoryCard);
