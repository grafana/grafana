import React, { useState } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme, Forms } from '@grafana/ui';
import { GrafanaTheme, AppEvents, DataSourceApi } from '@grafana/data';
import { RichHistoryQuery, ExploreId } from 'app/types/explore';
import { copyStringToClipboard, createUrlFromRichHistory, createDataQuery } from 'app/core/utils/richHistory';
import appEvents from 'app/core/app_events';
import { StoreState } from 'app/types';

import { changeDatasource, updateRichHistory, setQueries } from '../state/actions';
interface Props {
  query: RichHistoryQuery;
  dsImg: string;
  isRemoved: boolean;
  changeDatasource: typeof changeDatasource;
  updateRichHistory: typeof updateRichHistory;
  setQueries: typeof setQueries;
  exploreId: ExploreId;
  datasourceInstance: DataSourceApi;
}

const getStyles = stylesFactory((theme: GrafanaTheme, isRemoved?: boolean) => {
  const borderColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark4;
  const cardColor = theme.isLight
    ? isRemoved
      ? theme.colors.gray6
      : theme.colors.white
    : isRemoved
    ? theme.colors.dark10
    : theme.colors.dark7;
  const cardBoxShadow = theme.isLight ? `0px 2px 2px ${borderColor}` : `0px 2px 4px black`;

  return {
    queryCard: css`
      display: flex;
      flex-direction: column;
      border: 1px solid ${borderColor};
      margin: ${theme.spacing.sm} 0;
      box-shadow: ${cardBoxShadow};
      background-color: ${cardColor};
      border-radius: ${theme.border.radius};
      .starred {
        color: ${theme.colors.orange};
      }
      .lower-card-row {
        border-bottom: none;
        padding: ${theme.spacing.sm};
      }
    `,
    cardRow: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid ${borderColor};
      padding: ${theme.spacing.xs} ${theme.spacing.sm};
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
      font-weight: ${theme.typography.weight.bold};
    `,
    queryActionButtons: css`
      width: 160px;
      display: flex;
      justify-content: flex-end;
      font-size: ${theme.typography.size.base};
      i {
        margin: ${theme.spacing.xs};
        cursor: pointer;
      }
    `,
    queryContainer: css`
      font-weight: ${theme.typography.weight.bold};
      width: calc(100% - 176px);
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
    comment: css`
      overflow-wrap: break-word;
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.regular};
      margin-top: ${theme.spacing.xs};
    `,
    commentButtonRow: css`
      > * {
        margin-right: ${theme.spacing.xs};
      }
    `,
    textArea: css`
      border: 1px solid ${borderColor};
      background: inherit;
      color: inherit;
      width: 100%;
      margin: ${theme.spacing.sm} 0;
      font-size: ${theme.typography.size.sm};
      &placeholder {
        padding: 0 ${theme.spacing.xs};
      }
    `,
    runButton: css`
      width: 160px;
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
  const [starred, setStared] = useState(query.starred);
  const [activeUpdateComment, setActiveUpdateComment] = useState(false);
  const [comment, setComment] = useState<string | undefined>(query.comment);

  const toggleActiveUpdateComment = () => setActiveUpdateComment(!activeUpdateComment);
  const theme = useTheme();
  const styles = getStyles(theme, isRemoved);

  const onRunQuery = async (query: RichHistoryQuery) => {
    const dataQueries = query.queries.map((q, i) => createDataQuery(query, q, i));
    if (query.datasourceName !== datasourceInstance?.name) {
      await changeDatasource(exploreId, query.datasourceName);
      setQueries(exploreId, dataQueries);
    } else {
      setQueries(exploreId, dataQueries);
    }
  };

  const queryActions = (
    <div className={styles.queryActionButtons}>
      <i
        className="fa fa-fw fa-comment-o"
        onClick={() => {
          toggleActiveUpdateComment();
        }}
        title={query.comment?.length > 0 ? 'Edit comment' : 'Add comment'}
      ></i>
      <i
        className="fa fa-fw fa-copy"
        onClick={() => {
          const queries = query.queries.join('\n\n');
          copyStringToClipboard(queries);
          appEvents.emit(AppEvents.alertSuccess, ['Query copied to clipboard']);
        }}
        title="Copy query to clipboard"
      ></i>
      {!isRemoved && (
        <i
          className="fa fa-fw fa-link"
          onClick={() => {
            const url = createUrlFromRichHistory(query);
            copyStringToClipboard(url);
            appEvents.emit(AppEvents.alertSuccess, ['Link copied to clipboard']);
          }}
          title="Copy link to clipboard"
        ></i>
      )}
      <i
        className={'fa fa-trash'}
        title={'Delete query'}
        onClick={() => {
          updateRichHistory(query.ts, 'delete');
          appEvents.emit(AppEvents.alertSuccess, ['Query deleted']);
        }}
      ></i>
      <i
        className={cx('fa fa-fw', starred ? 'fa-star starred' : 'fa-star-o')}
        onClick={() => {
          updateRichHistory(query.ts, 'starred');
          setStared(!starred);
        }}
        title={query.starred ? 'Unstar query' : 'Star query'}
      ></i>
    </div>
  );

  const updateComment = (
    <div>
      <Forms.TextArea
        value={comment}
        placeholder={comment ? undefined : 'Add optional comment of what query does'}
        onChange={e => setComment(e.currentTarget.value)}
        className={styles.textArea}
      />
      <div className={styles.commentButtonRow}>
        <Forms.Button
          onClick={e => {
            e.preventDefault();
            updateRichHistory(query.ts, 'comment', comment);
            toggleActiveUpdateComment();
          }}
        >
          Save
        </Forms.Button>
        <Forms.Button
          variant="secondary"
          className={css`
            margin-left: 8px;
          `}
          onClick={() => {
            toggleActiveUpdateComment();
            setComment(query.comment);
          }}
        >
          Cancel
        </Forms.Button>
      </div>
    </div>
  );

  return (
    <div className={styles.queryCard}>
      <div className={styles.cardRow}>
        <div className={styles.datasourceContainer}>
          <img src={dsImg} aria-label="Data source icon" />
          <div>{isRemoved ? 'Not linked to existing datasource' : query.datasourceName}</div>
        </div>
        {queryActions}
      </div>
      <div className={cx(styles.cardRow, 'lower-card-row')}>
        <div className={styles.queryContainer}>
          {query.queries.map((q, i) => {
            return (
              <div key={`${q}-${i}`} className={styles.queryRow}>
                {q}
              </div>
            );
          })}
          {!activeUpdateComment && query.comment && <div className={styles.comment}>{query.comment}</div>}
          {activeUpdateComment && updateComment}
        </div>
        <div className={styles.runButton}>
          <Forms.Button
            variant="secondary"
            onClick={e => {
              e.preventDefault();
              onRunQuery(query);
            }}
            disabled={isRemoved}
          >
            {datasourceInstance?.name === query.datasourceName ? 'Run query' : 'Switch data source and run query'}
          </Forms.Button>
        </div>
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
