import React, { FunctionComponent } from 'react';
import { css } from 'emotion';
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { Query } from './QueryHistoryQueries';

interface Props {
  query: Query;
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
    `,
    queryCardLeft: css``,
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
      :last-child {
        border-top: none;
      }
    `,
  };
});

export const QueryHistoryCard: FunctionComponent<Props> = ({ query }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <div className={styles.queryCard}>
      <div className={styles.queryCardLeft}>
        {query.queries.map(q => (
          <div className={styles.queryRow}>{q}</div>
        ))}
        {query.comment && <div>{query.comment}</div>}
      </div>
      <div className={styles.queryCardRight}>
        <i className="fa fa-fw fa-copy"></i>
        <i className="fa fa-fw fa-link" style={{ fontWeight: 'normal' }}></i>
        <i className="fa fa-fw fa-star-o"></i>
      </div>
    </div>
  );
};
