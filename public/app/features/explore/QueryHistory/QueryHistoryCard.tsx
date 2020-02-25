import React, { FunctionComponent, useState } from 'react';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { Query } from './QueryHistoryQueries';

interface Props {
  query: Query;
  updateStarredQuery: (ts: number) => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark4;
  const cardColor = theme.isLight ? theme.colors.white : theme.colors.dark7;
  return {
    queryCard: css`
      border: 1px solid ${bgColor};
      padding: ${theme.spacing.sm};
      margin: ${theme.spacing.sm} 0;
      box-shadow: 0px 2px 2px ${bgColor};
      background-color: ${cardColor};
      border-radius: ${theme.border.radius};
      display: flex;
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

export const QueryHistoryCard: FunctionComponent<Props> = ({ query, updateStarredQuery }) => {
  const [starred, updateStared] = useState(query.starred);

  const theme = useTheme();
  const styles = getStyles(theme);

  const copyQueryToClipboard = () => {
    const el = document.createElement('textarea');
    el.value = query.queries.join('\n\n');
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  };

  return (
    <div className={styles.queryCard}>
      <div className={styles.queryCardLeft}>
        {query.queries
          .filter(q => q !== '')
          .map((q, index) => (
            <div key={`${q}-${index}`} className={styles.queryRow}>
              {q}
            </div>
          ))}
        {query.comment && <div>{query.comment}</div>}
      </div>
      <div className={styles.queryCardRight}>
        <i className="fa fa-fw fa-copy" onClick={copyQueryToClipboard}></i>
        <i className="fa fa-fw fa-link" style={{ fontWeight: 'normal' }}></i>
        <i
          className={cx('fa fa-fw', starred ? 'fa-star starred' : 'fa-star-o')}
          onClick={() => {
            updateStarredQuery(query.ts);
            updateStared(!starred);
          }}
        ></i>
      </div>
    </div>
  );
};
