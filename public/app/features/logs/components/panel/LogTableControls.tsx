import { css, cx } from '@emotion/css';
import { useCallback } from 'react';

import { GrafanaTheme2, LogsSortOrder, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { CONTROLS_WIDTH_EXPANDED } from './LogListControls';
import { LogListControlsOption } from './LogListControlsOption';
import { LOG_LIST_CONTROLS_WIDTH } from './virtualization';

type Props = {
  controlsExpanded: boolean;
  setControlsExpanded: (expanded: boolean) => void;
  setSortOrder: (sortOrder: LogsSortOrder) => void;
  logOptionsStorageKey?: string;
  sortOrder: LogsSortOrder;
};

export const LogTableControls = ({
  controlsExpanded,
  logOptionsStorageKey,
  setControlsExpanded,
  setSortOrder,
  sortOrder,
}: Props) => {
  const styles = useStyles2(getStyles, controlsExpanded);

  const onExpandControlsClick = useCallback(() => {
    reportInteraction('logs_log_list_controls_expand_controls_clicked');
    setControlsExpanded(!controlsExpanded);
    store.set(`${logOptionsStorageKey}.controlsExpanded`, !controlsExpanded);
  }, [controlsExpanded, logOptionsStorageKey, setControlsExpanded]);

  const onSortOrderClick = useCallback(() => {
    reportInteraction('logs_log_list_controls_sort_order_clicked', {
      order: sortOrder === LogsSortOrder.Ascending ? LogsSortOrder.Descending : LogsSortOrder.Ascending,
    });
    setSortOrder(sortOrder === LogsSortOrder.Ascending ? LogsSortOrder.Descending : LogsSortOrder.Ascending);
  }, [setSortOrder, sortOrder]);

  return (
    <div className={styles.navContainer}>
      <>
        <LogListControlsOption
          expanded={controlsExpanded}
          name="arrow-from-right"
          className={cx(styles.controlButton, styles.controlsExpandedButton)}
          variant="secondary"
          onClick={onExpandControlsClick}
          label={
            controlsExpanded
              ? t('logs.logs-controls.label.collapse', 'Expanded')
              : t('logs.logs-controls.label.expand', 'Collapsed')
          }
          tooltip={
            controlsExpanded ? t('logs.logs-controls.collapse', 'Collapse') : t('logs.logs-controls.expand', 'Expand')
          }
          size="lg"
        />
      </>
      <LogListControlsOption
        expanded={controlsExpanded}
        name={sortOrder === LogsSortOrder.Descending ? 'sort-amount-up' : 'sort-amount-down'}
        className={styles.controlButton}
        onClick={onSortOrderClick}
        label={
          sortOrder === LogsSortOrder.Descending
            ? t('logs.logs-controls.labels.newest-first', 'Newest logs first')
            : t('logs.logs-controls.labels.oldest-first', 'Oldest logs first')
        }
        tooltip={
          sortOrder === LogsSortOrder.Descending
            ? t('logs.logs-controls.newest-first', 'Sorted by newest logs first - Click to show oldest first')
            : t('logs.logs-controls.oldest-first', 'Sorted by oldest logs first - Click to show newest first')
        }
        size="lg"
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, controlsExpanded: boolean) => {
  return {
    navContainer: css({
      height: '100%',
      display: 'flex',
      flex: '1 0 auto',
      gap: theme.spacing(3),
      flexDirection: 'column',
      justifyContent: 'flex-start',
      width: controlsExpanded ? CONTROLS_WIDTH_EXPANDED : LOG_LIST_CONTROLS_WIDTH,
      paddingTop: theme.spacing(0.75),
      paddingLeft: theme.spacing(1),
      borderLeft: `solid 1px ${theme.colors.border.medium}`,
      minWidth: theme.spacing(4),
      backgroundColor: theme.colors.background.primary,
    }),
    controlsExpandedButton: css({
      transform: !controlsExpanded ? 'rotate(180deg)' : '',
    }),
    controlButton: css({
      margin: 0,
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
    }),
  };
};
