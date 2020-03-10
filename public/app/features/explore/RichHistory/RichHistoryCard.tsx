import React, { useState } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme, Forms, styleMixins } from '@grafana/ui';
import { GrafanaTheme, AppEvents, DataSourceApi } from '@grafana/data';
import { RichHistoryQuery, ExploreId } from 'app/types/explore';
import { copyStringToClipboard, createUrlFromRichHistory, createDataQuery } from 'app/core/utils/richHistory';
import appEvents from 'app/core/app_events';
import { StoreState } from 'app/types';

import { changeQuery, changeDatasource, clearQueries, updateRichHistory } from '../state/actions';
interface Props {
  query: RichHistoryQuery;
  changeQuery: typeof changeQuery;
  changeDatasource: typeof changeDatasource;
  clearQueries: typeof clearQueries;
  updateRichHistory: typeof updateRichHistory;
  exploreId: ExploreId;
  datasourceInstance: DataSourceApi;
}

const getStyles = stylesFactory((theme: GrafanaTheme, hasComment?: boolean) => {
  const bgColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark4;
  const cardBottomPadding = hasComment ? theme.spacing.sm : theme.spacing.xs;

  return {
    queryCard: css`
      ${styleMixins.listItem(theme)}
      display: flex;
      padding: ${theme.spacing.sm} ${theme.spacing.sm} ${cardBottomPadding};
      margin: ${theme.spacing.sm} 0;

      .starred {
        color: ${theme.colors.orange};
      }
    `,
    queryCardLeft: css`
      padding-right: 10px;
      width: calc(100% - 150px);
      cursor: pointer;
    `,
    queryCardRight: css`
      width: 150px;
      display: flex;
      justify-content: flex-end;

      i {
        margin: ${theme.spacing.xs};
        cursor: pointer;
      }
    `,
    queryRow: css`
      border-top: 1px solid ${bgColor};
      word-break: break-all;
      padding: 4px 2px;
      :first-child {
        border-top: none;
        padding: 0 0 4px 0;
      }
    `,
    buttonRow: css`
      > * {
        margin-right: ${theme.spacing.xs};
      }
    `,
    comment: css`
      overflow-wrap: break-word;
      font-size: ${theme.typography.size.sm};
      margin-top: ${theme.spacing.xs};
    `,
  };
});

export function RichHistoryCard(props: Props) {
  const {
    query,
    updateRichHistory,
    changeQuery,
    changeDatasource,
    exploreId,
    clearQueries,
    datasourceInstance,
  } = props;
  const [starred, setStared] = useState(query.starred);
  const [activeUpdateComment, setActiveUpdateComment] = useState(false);
  const [comment, setComment] = useState<string | undefined>(query.comment);

  const toggleActiveUpdateComment = () => setActiveUpdateComment(!activeUpdateComment);
  const theme = useTheme();
  const styles = getStyles(theme, Boolean(query.comment));

  const changeQueries = () => {
    query.queries.forEach((q, i) => {
      const dataQuery = createDataQuery(query, q, i);
      changeQuery(exploreId, dataQuery, i);
    });
  };

  const onChangeQuery = async (query: RichHistoryQuery) => {
    if (query.datasourceName !== datasourceInstance?.name) {
      await changeDatasource(exploreId, query.datasourceName);
      changeQueries();
    } else {
      clearQueries(exploreId);
      changeQueries();
    }
  };

  return (
    <div className={styles.queryCard}>
      <div className={styles.queryCardLeft} onClick={() => onChangeQuery(query)}>
        {query.queries.map((q, i) => {
          return (
            <div key={`${q}-${i}`} className={styles.queryRow}>
              {q}
            </div>
          );
        })}
        {!activeUpdateComment && query.comment && <div className={styles.comment}>{query.comment}</div>}
        {activeUpdateComment && (
          <div>
            <Forms.TextArea
              value={comment}
              placeholder={comment ? undefined : 'add comment'}
              onChange={e => setComment(e.currentTarget.value)}
            />
            <div className={styles.buttonRow}>
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
        )}
      </div>
      <div className={styles.queryCardRight}>
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
        <i
          className="fa fa-fw fa-link"
          onClick={() => {
            const url = createUrlFromRichHistory(query);
            copyStringToClipboard(url);
            appEvents.emit(AppEvents.alertSuccess, ['Link copied to clipboard']);
          }}
          style={{ fontWeight: 'normal' }}
          title="Copy link to clipboard"
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
  changeQuery,
  changeDatasource,
  clearQueries,
  updateRichHistory,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(RichHistoryCard));
