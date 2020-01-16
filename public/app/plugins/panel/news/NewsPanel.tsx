// Libraries
import React from 'react';
import { css } from 'emotion';

// Utils & Services
import { GrafanaTheme, dateTime } from '@grafana/data';
import { stylesFactory, styleMixins, CustomScrollbar } from '@grafana/ui';

// Types
import { PanelProps, DataFrameView } from '@grafana/data';
import { sanitize } from 'app/core/utils/text';
import { config } from 'app/core/config';

interface Props extends PanelProps {}

export const NewsPanel: React.FC<Props> = ({ data }) => {
  if (data.error) {
    return (
      <div className="panel-empty">
        <p>Ups, feed failed loading</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const news = new DataFrameView(data.series[0]);
  const styles = getStyles(config.theme);

  return (
    <div className={styles.container}>
      <CustomScrollbar>
        {news.map((item, index) => {
          return (
            <div key={index} className={styles.item}>
              <a href={item.link} target="_blank">
                <div className={styles.title}>{item.title}</div>
                <div className={styles.date}>{dateTime(item.date).format('MMM DD')} </div>
                <div className={styles.content} dangerouslySetInnerHTML={{ __html: sanitize(item.content) }} />
              </a>
            </div>
          );
        })}
      </CustomScrollbar>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  container: css`
    height: 100%;
  `,
  item: css`
    ${styleMixins.cardChrome(theme)}
    padding: ${theme.spacing.sm};
    position: relative;
    margin-bottom: 4px;
    border-radius: 3px;
    margin-right: ${theme.spacing.sm};
  `,
  title: css`
    color: ${theme.colors.linkExternal};
    max-width: calc(100% - 70px);
    font-size: 16px;
    margin-bottom: ${theme.spacing.sm};
  `,
  content: css`
    p {
      margin-bottom: 4px;
    }
  `,
  date: css`
    position: absolute;
    top: 0;
    right: 0;
    background: ${theme.colors.bodyBg};
    width: 55px;
    text-align: right;
    padding: ${theme.spacing.xs};
    font-weight: 500;
    border-radius: 0 0 0 3px;
    color: ${theme.colors.textWeak};
  `,
}));
