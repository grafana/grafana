import React, { FunctionComponent, useState } from 'react';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, ExploreMode, AppEvents } from '@grafana/data';
import { QueryHistoryQuery } from './QueryHistoryQueries';
import { copyQueryToClipboard, copyToClipboard, createUrlFromQueryHistory } from '../../../core/utils/explore';
import { renderUrl } from 'app/core/utils/url';
import appEvents from 'app/core/app_events';

interface Props {
  query: QueryHistoryQuery;
  onChangeQueryHistoryProperty: (ts: number, property: string) => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark4;
  const cardColor = theme.isLight ? theme.colors.white : theme.colors.dark7;
  return {
    queryCard: css`
      display: flex;
      border: 1px solid ${bgColor};
      padding: ${theme.spacing.sm};
      margin: ${theme.spacing.sm} 0;
      box-shadow: 0px 2px 2px ${bgColor};
      background-color: ${cardColor};
      border-radius: ${theme.border.radius};
      .starred {
        color: ${theme.colors.blue77};
      }
    `,
    queryCardLeft: css`
      width: 100%;
      padding-right: 10px;
    `,
    queryCardRight: css`
      flex: 100px;
      display: flex;
      justify-content: flex-end;
      i {
        font-size: ${theme.typography.size.lg};
        font-weight: ${theme.typography.weight.bold};
        margin: 3px;
        cursor: pointer;
      }
    `,
    queryRow: css`
      border-top: 2px solid ${bgColor};
      font-weight: ${theme.typography.weight.bold};
      padding: 4px 2px;
      :first-child {
        border-top: none;
        padding: 0 0 4px 0;
      }
    `,
  };
});

export const QueryHistoryCard: FunctionComponent<Props> = ({ query, onChangeQueryHistoryProperty }) => {
  const [starred, updateStared] = useState(query.starred);
  let queryExpressions: any[] = query.queries.filter(q => Boolean(q));

  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <>
      {queryExpressions.length > 0 && (
        <div className={styles.queryCard}>
          <div className={styles.queryCardLeft}>
            {queryExpressions.map((q, index) => {
              return (
                <div key={`${q}-${index}`} className={styles.queryRow}>
                  {q}
                </div>
              );
            })}
            {query.comment && <div>{query.comment}</div>}
          </div>
          <div className={styles.queryCardRight}>
            <i
              className="fa fa-fw fa-copy"
              onClick={() => {
                const queries = query.queries.join('\n\n');
                copyToClipboard(queries);
                appEvents.emit(AppEvents.alertSuccess, ['Query copied to clipboard']);
              }}
            ></i>
            <i
              className="fa fa-fw fa-link"
              onClick={() => {
                const url = createUrlFromQueryHistory(query);
                copyToClipboard(url);
                appEvents.emit(AppEvents.alertSuccess, ['Link copied to clipboard']);
              }}
              style={{ fontWeight: 'normal' }}
            ></i>
            <i
              className={cx('fa fa-fw', starred ? 'fa-star starred' : 'fa-star-o')}
              onClick={() => {
                onChangeQueryHistoryProperty(query.ts, 'starred');
                updateStared(!starred);
              }}
            ></i>
          </div>
        </div>
      )}
    </>
  );
};
