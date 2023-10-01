import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

import { MinimalisticPagination } from './MinimalisticPagination';

export interface GenerationHistoryCarouselProps {
  history: string[];
  index: number;
  reply: string;
  onNavigate: (index: number) => void;
}

export const GenerationHistoryCarousel = ({ history, index, reply, onNavigate }: GenerationHistoryCarouselProps) => {
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
      <MinimalisticPagination
        currentPage={index}
        numberOfPages={historySize}
        onNavigate={onNavigate}
        hideWhenSinglePage={true}
        className={styles.paginationWrapper}
      />
      <div className={styles.contentWrapper}>
        <Text element="p" color="secondary">
          {getHistoryText()}
        </Text>
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  paginationWrapper: css({
    display: 'flex',
    flexDirection: 'row',
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
