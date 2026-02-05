import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

import { TIME_OPTION_PLACEHOLDER } from '../../constants';
import { useDatasourceContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';

interface FooterLabelValue {
  id: string;
  label: string;
  value: string;
  isActive?: boolean;
}

export function QueryEditorFooter() {
  const styles = useStyles2(getStyles);

  const { queryOptions } = useQueryEditorUIContext();
  const { options, setIsQueryOptionsOpen } = queryOptions;
  const { data } = useQueryRunnerContext();
  const { datasource } = useDatasourceContext();

  // Compute footer items from actual query options
  // Items with isActive=true have non-default (user-set) values and are highlighted
  const items: FooterLabelValue[] = useMemo(() => {
    const realMaxDataPoints = data?.request?.maxDataPoints;
    const realInterval = data?.request?.interval;
    const minIntervalOnDs = datasource?.interval ?? t('query-editor.footer.placeholder.no-limit', 'No limit');

    return [
      {
        id: 'maxDataPoints',
        label: t('query-editor.footer.label.max-data-points', 'Max data points'),
        value: options.maxDataPoints != null ? String(options.maxDataPoints) : String(realMaxDataPoints ?? '-'),
        isActive: options.maxDataPoints != null,
      },
      {
        id: 'minInterval',
        label: t('query-editor.footer.label.min-interval', 'Min interval'),
        value: options.minInterval ?? minIntervalOnDs,
        isActive: options.minInterval != null,
      },
      {
        id: 'interval',
        label: t('query-editor.footer.label.interval', 'Interval'),
        value: realInterval ?? '-',
        isActive: false, // Interval is always computed, never user-set
      },
      {
        id: 'relativeTime',
        label: t('query-editor.footer.label.relative-time', 'Relative time'),
        value: options.timeRange?.from ?? TIME_OPTION_PLACEHOLDER,
        isActive: options.timeRange?.from != null,
      },
      {
        id: 'timeShift',
        label: t('query-editor.footer.label.time-shift', 'Time shift'),
        value: options.timeRange?.shift ?? TIME_OPTION_PLACEHOLDER,
        isActive: options.timeRange?.shift != null,
      },
    ];
  }, [options, data, datasource]);

  const handleOpenSidebar = () => {
    setIsQueryOptionsOpen(true);
  };

  return (
    <div className={styles.container}>
      <ul className={styles.itemsList}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <Button
              fill="text"
              size="sm"
              className={styles.itemButton}
              onClick={handleOpenSidebar}
              aria-label={t('query-editor.footer.edit-option', 'Edit {{label}}', { label: item.label })}
            >
              {item.isActive && <span className={styles.activeIndicator} />}
              <span className={styles.label}>{item.label}</span>
              <span className={cx(styles.value, item.isActive && styles.valueActive)}>{item.value}</span>
            </Button>
          </li>
        ))}
      </ul>
      <Button
        fill="text"
        size="sm"
        icon="angle-left"
        iconPlacement="right"
        onClick={handleOpenSidebar}
        aria-label={t('query-editor.footer.query-options', 'Query Options')}
      >
        <Trans i18nKey="query-editor.footer.query-options">Query Options</Trans>
      </Button>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      position: 'sticky',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(2),
      backgroundColor: theme.colors.background.secondary,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderBottomLeftRadius: theme.shape.radius.default,
      borderBottomRightRadius: theme.shape.radius.default,
      padding: theme.spacing(0.5, 0.5, 0.5, 1.5),
      zIndex: 1,
      minHeight: 26,
    }),
    itemsList: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      listStyle: 'none',
      margin: 0,
      padding: 0,
      flexWrap: 'wrap',
      flex: 1,
    }),
    item: css({
      display: 'flex',
      alignItems: 'center',
    }),
    itemButton: css({
      // Override Button's default padding and add gap for children
      padding: theme.spacing(0, 0.5),

      '& > span': {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.5),
      },
    }),
    label: css({
      color: theme.colors.text.primary,
    }),
    value: css({
      color: theme.colors.text.secondary,
    }),
    valueActive: css({
      color: theme.colors.success.text,
    }),
    activeIndicator: css({
      width: 6,
      height: 6,
      borderRadius: theme.shape.radius.circle,
      backgroundColor: theme.colors.success.text,
      flexShrink: 0,
    }),
  };
}
