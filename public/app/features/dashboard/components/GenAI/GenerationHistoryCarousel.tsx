import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

import { MinimalisticPagination } from './MinimalisticPagination';

export interface GenerationHistoryCarouselProps {
  history: string[];
  index: number;
  onNavigate: (index: number) => void;
}

export const GenerationHistoryCarousel = ({ history, index, onNavigate }: GenerationHistoryCarouselProps) => {
  const styles = useStyles2(getStyles);
  const historySize = history.length;

  return (
    <>
      <div className={styles.contentWrapper}>
        <Text element="p" color="secondary">
          {history[index - 1]}
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
