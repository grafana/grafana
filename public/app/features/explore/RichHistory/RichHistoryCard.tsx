import React, { useState } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme, Forms, Button } from '@grafana/ui';
import { GrafanaTheme, AppEvents, DataSourceApi } from '@grafana/data';
import { RichHistoryQuery, ExploreId } from 'app/types/explore';
import { copyStringToClipboard, createUrlFromRichHistory, createDataQuery } from 'app/core/utils/richHistory';
import appEvents from 'app/core/app_events';
import { StoreState } from 'app/types';

import { changeDatasource, updateRichHistory, setQueries } from '../state/actions';
export interface Props {
  query: RichHistoryQuery;
  dsImg: string;
  isRemoved: boolean;
  changeDatasource: typeof changeDatasource;
  updateRichHistory: typeof updateRichHistory;
  setQueries: typeof setQueries;
  exploreId: ExploreId;
  datasourceInstance: DataSourceApi;
}

const getStyles = stylesFactory((theme: GrafanaTheme, isRemoved: boolean) => {
  /* Hard-coded value so all buttons and icons on right side of card are aligned */
  const rigtColumnWidth = '240px';
  const rigtColumnContentWidth = '170px';

  const borderColor = theme.isLight ? theme.colors.gray5 : theme.colors.gray25;

  /* If datasource was removed, card will have inactive color */
  const cardColor = theme.isLight
    ? isRemoved
      ? theme.colors.gray95
      : theme.colors.white
    : isRemoved
    ? theme.colors.gray15
    : theme.colors.gray05;

  return {
    queryCard: css`
      display: flex;
      flex-direction: column;
      border: 1px solid ${borderColor};
      margin: ${theme.spacing.sm} 0;
      background-color: ${cardColor};
      border-radius: ${theme.border.radius.sm};
      .starred {
        color: ${theme.colors.orange};
      }
    `,
    cardRow: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.spacing.sm};
      border-bottom: none;
      :first-of-type {
        border-bottom: 1px solid ${borderColor};
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
      max-width: ${rigtColumnContentWidth};
      display: flex;
      justify-content: flex-end;
      font-size: ${theme.typography.size.base};
      i {
        margin: ${theme.spacing.xs};
        cursor: pointer;
      }
    `,
    queryContainer: css`
      font-weight: ${theme.typography.weight.semibold};
      width: calc(100% - ${rigtColumnWidth});
    `,
    queryRow: css`
      border-top: 1px solid ${borderColor};
      word-break: break-all;
      padding: 4px 2px;
      :first-child {
        border-top: none;
        padding: 0 0 4px 0;
      }
    `,
    updateCommentContainer: css`
      width: calc(100% + ${rigtColumnWidth});
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
      border: 1px solid ${borderColor};
      background: inherit;
      color: inherit;
      width: 100%;
      font-size: ${theme.typography.size.sm};
      &placeholder {
        padding: 0 ${theme.spacing.sm};
      }
    `,
    runButton: css`
      max-width: ${rigtColumnContentWidth};
      display: flex;
      justify-content: flex-end;
      button {
        height: auto;
        padding: ${theme.spacing.sm} ${theme.spacing.md};
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
    updateRichHistory,
    changeDatasource,
    exploreId,
    datasourceInstance,
    setQueries,
  } = props;
  const [activeUpdateComment, setActiveUpdateComment] = useState(false);
  const [comment, setComment] = useState<string | undefined>(query.comment);

  const toggleActiveUpdateComment = () => setActiveUpdateComment(!activeUpdateComment);
  const theme = useTheme();
  const styles = getStyles(theme, isRemoved);

  const onRunQuery = async () => {
    const dataQueries = query.queries.map((q, i) => createDataQuery(query, q, i));
    if (query.datasourceName !== datasourceInstance?.name) {
      await changeDatasource(exploreId, query.datasourceName);
      setQueries(exploreId, dataQueries);
    } else {
      setQueries(exploreId, dataQueries);
    }
  };

  const onCopyQuery = () => {
    const queries = query.queries.join('\n\n');
    copyStringToClipboard(queries);
    appEvents.emit(AppEvents.alertSuccess, ['Query copied to clipboard']);
  };

  const onCreateLink = () => {
    const url = createUrlFromRichHistory(query);
    copyStringToClipboard(url);
    appEvents.emit(AppEvents.alertSuccess, ['Link copied to clipboard']);
  };

  const onDeleteQuery = () => {
    updateRichHistory(query.ts, 'delete');
    appEvents.emit(AppEvents.alertSuccess, ['Query deleted']);
  };

  const onStarrQuery = () => {
    updateRichHistory(query.ts, 'starred');
  };

  const onUpdateComment = () => {
    updateRichHistory(query.ts, 'comment', comment);
    toggleActiveUpdateComment();
  };

  const onCancelUpdateComment = () => {
    toggleActiveUpdateComment();
    setComment(query.comment);
  };

  const updateComment = (
    <div className={styles.updateCommentContainer}>
      <Forms.TextArea
        value={comment}
        placeholder={comment ? undefined : 'An optional description of what the query does.'}
        onChange={e => setComment(e.currentTarget.value)}
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
      <i
        className="fa fa-fw fa-comment-o"
        onClick={toggleActiveUpdateComment}
        title={query.comment?.length > 0 ? 'Edit comment' : 'Add comment'}
      ></i>
      <i className="fa fa-fw fa-copy" onClick={onCopyQuery} title="Copy query to clipboard"></i>
      {!isRemoved && <i className="fa fa-fw fa-link" onClick={onCreateLink} title="Copy link to clipboard"></i>}
      <i className={'fa fa-trash'} title={'Delete query'} onClick={onDeleteQuery}></i>
      <i
        className={cx('fa fa-fw', query.starred ? 'fa-star starred' : 'fa-star-o')}
        onClick={onStarrQuery}
        title={query.starred ? 'Unstar query' : 'Star query'}
      ></i>
    </div>
  );

  return (
    <div className={styles.queryCard}>
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
            return (
              <div aria-label="Query text" key={`${q}-${i}`} className={styles.queryRow}>
                {q}
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
              {datasourceInstance?.name === query.datasourceName ? 'Run query' : 'Switch data source and run query'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  const { datasourceInstance } = explore[exploreId];
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  return {
    exploreId,
    datasourceInstance,
  };
}

const mapDispatchToProps = {
  changeDatasource,
  updateRichHistory,
  setQueries,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(RichHistoryCard));
