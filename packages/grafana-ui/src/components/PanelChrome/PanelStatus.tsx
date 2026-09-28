import { css } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Stack } from '../Layout/Stack/Stack';
import { Toggletip } from '../Toggletip/Toggletip';

import { usePanelContext } from './PanelContext';
import { type PanelStatusItem, type PanelStatusSeverity } from './types';

export interface Props {
  /** Single status message (legacy). Used when `items` is not provided. */
  message?: string;
  /** Structured list of errors and notices to show in the status popover. */
  items?: PanelStatusItem[];
  /** Fired when the user clicks Inspect, alongside PanelContext's `onOpenInspector`. Use for host-side side effects (e.g. telemetry). */
  onClick?: (e: React.SyntheticEvent) => void;
  ariaLabel?: string;
}

const SEVERITY_RANK: Record<PanelStatusSeverity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

function getTopSeverity(items: PanelStatusItem[]): PanelStatusSeverity {
  return items.reduce<PanelStatusSeverity>(
    (top, item) => (SEVERITY_RANK[item.severity] > SEVERITY_RANK[top] ? item.severity : top),
    'info'
  );
}

function getSeverityIcon(severity: PanelStatusSeverity): IconName {
  return severity === 'info' ? 'info-circle' : 'exclamation-triangle';
}

export function PanelStatus({ message, items, onClick, ariaLabel = 'status' }: Props) {
  const { onOpenInspector, onInvestigateErrors } = usePanelContext();
  const canInspect = Boolean(onClick) || Boolean(onOpenInspector);

  const handleInspectClick = (e: React.SyntheticEvent) => {
    onClick?.(e);
    onOpenInspector?.();
  };

  if (items && items.length > 0) {
    return (
      <PanelStatusPopover
        items={items}
        onInspect={canInspect ? handleInspectClick : undefined}
        ariaLabel={ariaLabel}
        onInvestigateErrors={onInvestigateErrors}
      />
    );
  }

  return (
    <Button
      onClick={handleInspectClick}
      variant={'destructive'}
      icon="exclamation-triangle"
      size="sm"
      tooltip={message || ''}
      aria-label={ariaLabel}
      data-testid={selectors.components.Panels.Panel.status('error')}
    />
  );
}

interface PanelStatusPopoverProps {
  items: PanelStatusItem[];
  onInspect?: (e: React.SyntheticEvent) => void;
  ariaLabel: string;
  onInvestigateErrors?: () => void;
}

function PanelStatusPopover({ items, onInspect, ariaLabel, onInvestigateErrors }: PanelStatusPopoverProps) {
  const styles = useStyles2(getStyles);
  const topSeverity = getTopSeverity(items);
  const sortedItems = [...items].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  const content = (
    <Stack direction="column" gap={1}>
      {sortedItems.map((item, index) => (
        <div key={`${item.severity}-${index}`} className={styles.item}>
          <span className={styles.itemIcon}>
            <Icon name={getSeverityIcon(item.severity)} className={styles[item.severity]} size="sm" />
          </span>
          <span className={styles.itemText}>{item.text}</span>
        </div>
      ))}
    </Stack>
  );

  // Assistant stays on the left, Inspect on the right, regardless of whether either action is
  // shown — an empty placeholder keeps whichever one is present pinned to its side.
  const footer = (
    <Stack direction="row" justifyContent="space-between" alignItems="center" width="100%">
      {onInvestigateErrors ? (
        <Button size="sm" variant="secondary" fill="text" icon="ai-sparkle" onClick={onInvestigateErrors}>
          {/* Nothing to fix when the panel only carries notices, so don't promise a fix — the
              host asks the assistant to explain in that case. */}
          {topSeverity === 'error'
            ? t('grafana-ui.panel-chrome.fix-with-assistant', 'Fix with Assistant')
            : t('grafana-ui.panel-chrome.explain-with-assistant', 'Explain with Assistant')}
        </Button>
      ) : (
        <span />
      )}
      {onInspect ? (
        <Button size="sm" variant="secondary" fill="text" icon="arrow-right" onClick={onInspect}>
          {t('grafana-ui.panel-chrome.inspect', 'Inspect')}
        </Button>
      ) : (
        <span />
      )}
    </Stack>
  );

  return (
    <Toggletip content={content} footer={footer} placement="bottom-start">
      <Button
        variant={topSeverity === 'error' ? 'destructive' : 'secondary'}
        className={topSeverity !== 'error' ? styles[`${topSeverity}Button`] : undefined}
        icon={getSeverityIcon(topSeverity)}
        size="sm"
        aria-label={ariaLabel}
        data-testid={selectors.components.Panels.Panel.status(topSeverity)}
      />
    </Toggletip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  item: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    maxWidth: theme.spacing(40),
  }),
  itemIcon: css({
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    // Match the first text line's height so the icon is centered on it, even when the text wraps.
    height: `calc(${theme.typography.bodySmall.fontSize} * ${theme.typography.bodySmall.lineHeight})`,
  }),
  itemText: css({
    minWidth: 0,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  }),
  error: css({
    color: theme.colors.error.text,
  }),
  warning: css({
    color: theme.colors.warning.text,
  }),
  info: css({
    color: theme.colors.info.text,
  }),
  warningButton: css({
    color: theme.colors.warning.text,
  }),
  infoButton: css({
    color: theme.colors.info.text,
  }),
});
