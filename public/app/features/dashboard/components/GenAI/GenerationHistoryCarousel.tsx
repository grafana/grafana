import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Pagination, Text, useStyles2 } from '@grafana/ui';

export interface GenerationHistoryCarouselProps {
  history: string[];
  index: number;
  onNavigate: (index: number) => void;
  reply: string;
}

export const GenerationHistoryCarousel = ({ history, index, onNavigate, reply }: GenerationHistoryCarouselProps) => {
  const styles = useStyles2(getStyles);
  const historySize = history.length;

  const getHistoryText = () => {
    if (reply) {
      return reply;
    }

    return history[index - 1];
  };

  return (
    <>
      <div className={styles.wrapper}>
        <div className={styles.paginationWrapper}>
          <Pagination
            currentPage={index}
            numberOfPages={historySize}
            onNavigate={onNavigate}
            showSmallVersion={true}
            hideWhenSinglePage={true}
          />
        </div>
      </div>
      <div className={styles.contentWrapper}>
        <Text element="p" color="secondary">
          {getHistoryText()}
        </Text>
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  paginationWrapper: css({
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 15,
  }),
  contentWrapper: css({
    display: 'flex',
    flexBasis: '100%',
    flexGrow: 3,
    marginTop: 20,
  }),
});
