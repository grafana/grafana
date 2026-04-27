import { css, cx } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t, Trans } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2 } from '@grafana/ui/themes';
import { InspectTab } from 'app/features/inspector/types';

import { PanelInspectDrawer } from '../../../../inspect/PanelInspectDrawer';
import { getDashboardSceneFor } from '../../../../utils/utils';
import { FOOTER_HEIGHT, TIME_OPTION_PLACEHOLDER } from '../../constants';
import { trackQueryMenuAction, trackQueryOptionsToggle } from '../../tracking';
import {
  useDatasourceContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';
import { QueryOptionField } from '../types';

interface FooterLabelValue {
  id: QueryOptionField;
  label: string;
  value: string;
  isActive?: boolean;
}

export function QueryEditorFooter() {
  const styles = useStyles2(getStyles);

  const { queryOptions, cardType } = useQueryEditorUIContext();
  const { options, openSidebar, closeSidebar, isQueryOptionsOpen } = queryOptions;
  const { data } = useQueryRunnerContext();
  const { datasource } = useDatasourceContext();
  const { panel } = usePanelContext();

  const onOpenInspector = useCallback(() => {
    const dashboard = getDashboardSceneFor(panel);
    dashboard.showModal(new PanelInspectDrawer({ panelRef: panel.getRef(), currentTab: InspectTab.Query }));
    trackQueryMenuAction('open_inspector', cardType);
  }, [panel, cardType]);

  // Compute footer items from actual query options
  // Items with isActive=true have non-default (user-set) values and are highlighted
  const items: FooterLabelValue[] = useMemo(() => {
    const realMaxDataPoints = data?.request?.maxDataPoints;
    const realInterval = data?.request?.interval;
    const minIntervalOnDs = datasource?.interval ?? t('query-editor-next.footer.placeholder.no-limit', 'No limit');

    return [
      {
        id: QueryOptionField.maxDataPoints,
        label: t('query-editor-next.footer.label.max-data-points', 'Max data points'),
        value: options.maxDataPoints != null ? String(options.maxDataPoints) : String(realMaxDataPoints ?? '-'),
        isActive: options.maxDataPoints != null,
      },
      {
        id: QueryOptionField.minInterval,
        label: t('query-editor-next.footer.label.min-interval', 'Min interval'),
        value: options.minInterval ?? minIntervalOnDs,
        isActive: options.minInterval != null,
      },
      {
        id: QueryOptionField.interval,
        label: t('query-editor-next.footer.label.interval', 'Interval'),
        value: realInterval ?? '-',
        isActive: false, // Interval is always computed, never user-set
      },
      {
        id: QueryOptionField.relativeTime,
        label: t('query-editor-next.footer.label.relative-time', 'Relative time'),
        value: options.timeRange?.from ?? TIME_OPTION_PLACEHOLDER,
        isActive: options.timeRange?.from != null,
      },
      {
        id: QueryOptionField.timeShift,
        label: t('query-editor-next.footer.label.time-shift', 'Time shift'),
        value: options.timeRange?.shift ?? TIME_OPTION_PLACEHOLDER,
        isActive: options.timeRange?.shift != null,
      },
    ];
  }, [options, data, datasource]);

  const handleItemClick = (event: React.MouseEvent, fieldId?: QueryOptionField) => {
    // Stop propagation to prevent ClickOutsideWrapper from immediately closing
    event.stopPropagation();

    // Don't focus interval since it's read-only
    if (fieldId && fieldId !== QueryOptionField.interval) {
      trackQueryOptionsToggle(true);
      openSidebar(fieldId);
    } else if (!isQueryOptionsOpen) {
      trackQueryOptionsToggle(true);
      openSidebar();
    } else {
      trackQueryOptionsToggle(false);
      closeSidebar();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.queryOptionsWrapper}>
        <Button
          fill="text"
          size="sm"
          onClick={(e) => handleItemClick(e)}
          aria-label={t('query-editor-next.footer.query-options', 'Query Options')}
        >
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Trans i18nKey="query-editor-next.footer.query-options">Query Options</Trans>
            <Icon name="angle-down" className={cx(styles.chevron, { [styles.chevronOpen]: isQueryOptionsOpen })} />
          </Stack>
        </Button>
      </div>

      <ul className={styles.itemsList}>
        {items.map((item) => (
          <li key={item.id}>
            <Button
              fill="text"
              size="sm"
              className={styles.itemButton}
              onClick={(e) => handleItemClick(e, item.id)}
              aria-label={t('query-editor-next.footer.edit-option', 'Edit {{label}}', { label: item.label })}
            >
              {item.isActive && <span className={styles.activeIndicator} />}
              <span className={styles.label}>{item.label}</span>
              <span className={cx(styles.value, item.isActive && styles.valueActive)}>{item.value}</span>
            </Button>
          </li>
        ))}
      </ul>

      <div className={styles.footerActions}>
        <Button
          fill="text"
          size="sm"
          icon="crosshair"
          variant="secondary"
          onClick={onOpenInspector}
          aria-label={t('query-editor-next.footer.query-inspector', 'Query inspector')}
        >
          <Trans i18nKey="query-editor-next.footer.inspect-queries">Inspect queries</Trans>
        </Button>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      position: 'sticky',
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      backgroundColor: theme.colors.background.primary,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderBottomLeftRadius: theme.shape.radius.default,
      borderBottomRightRadius: theme.shape.radius.default,
      padding: theme.spacing(0, 0.5, 0, 1.5),
      zIndex: theme.zIndex.navbarFixed,
      height: FOOTER_HEIGHT,
    }),
    itemsList: css({
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      gap: theme.spacing(1),
      listStyle: 'none',
      margin: 0,
      padding: 0,
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      whiteSpace: 'nowrap',

      '&::after': {
        content: '""',
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: theme.spacing(4),
        background: `linear-gradient(to right, transparent, ${theme.colors.background.primary})`,
        pointerEvents: 'none',
      },
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
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
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
    chevron: css({
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create('transform', {
          duration: theme.transitions.duration.shorter,
          easing: theme.transitions.easing.easeInOut,
        }),
      },
    }),
    chevronOpen: css({
      transform: 'rotate(180deg)',
    }),
    queryOptionsWrapper: css({
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
    }),
    footerActions: css({
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
    }),
  };
}
