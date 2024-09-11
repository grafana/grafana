import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

import { MinimalisticPagination } from './MinimalisticPagination';
import { StreamStatus } from './hooks';

export interface GenerationHistoryCarouselProps {
  history: string[];
  index: number;
  reply: string;
  streamStatus: StreamStatus;
  onNavigate: (index: number) => void;
}

export const GenerationHistoryCarousel = ({
  history,
  index,
  reply,
  streamStatus,
  onNavigate,
}: GenerationHistoryCarouselProps) => {
  const styles = useStyles2(getStyles);
  const historySize = history.length;

  const getHistoryText = () => {
    if (reply && streamStatus !== StreamStatus.IDLE) {
      return reply;
    }

    return history[index - 1];
  };

  return (
    <>
      <div className={styles.contentWrapper}>
        <Text element="p" color="secondary">
          {getHistoryText()}
        </Text>
      </div>
      <MinimalisticPagination
        currentPage={index}
        numberOfPages={historySize}
        onNavigate={onNavigate}
        hideWhenSinglePage={false}
        className={styles.paginationWrapper}
      />
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
    whiteSpace: 'pre-wrap',
    maxHeight: 110,
    overflowY: 'scroll',
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1),
    minHeight: 60,
  }),
});
