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
import { Tooltip } from '../Tooltip/Tooltip';

import { type PanelStatusItem, type PanelStatusSeverity } from './types';

export interface Props {
  /** Single status message (legacy). Used when `items` is not provided. */
  message?: string;
  /** Structured list of errors and notices to show in the status popover. */
  items?: PanelStatusItem[];
  /** Opens the inspector "Errors and notices" tab. */
  onClick?: (e: React.SyntheticEvent) => void;
  ariaLabel?: string;
  /**
   * Triggers an AI-assisted investigation of the panel's errors/notices. The host (e.g.
   * dashboard) owns what this does; PanelStatus only decides whether to show the action.
   */
  onInvestigateErrors?: (e: React.SyntheticEvent) => void;
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

export function PanelStatus({ message, items, onClick, ariaLabel = 'status', onInvestigateErrors }: Props) {
  if (items && items.length > 0) {
    return (
      <PanelStatusPopover
        items={items}
        onInspect={onClick}
        ariaLabel={ariaLabel}
        onInvestigateErrors={onInvestigateErrors}
      />
    );
  }

  return (
    <Button
      onClick={onClick}
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
  onInvestigateErrors?: (e: React.SyntheticEvent) => void;
}

function PanelStatusPopover({ items, onInspect, ariaLabel, onInvestigateErrors }: PanelStatusPopoverProps) {
  const styles = useStyles2(getStyles);
  const topSeverity = getTopSeverity(items);
  const sortedItems = [...items].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  const content = (
    <div className={styles.popover}>
      <div className={styles.popoverHeader}>
        <Stack direction="row" gap={1} alignItems="center">
          <span className={styles.popoverTitle}>
            {t('grafana-ui.panel-chrome.errors-and-notices', 'Errors and notices')}
          </span>
          {onInvestigateErrors && (
            <Button size="sm" variant="secondary" fill="text" icon="ai-sparkle" onClick={onInvestigateErrors}>
              {/* Nothing to fix when the panel only carries notices, so don't promise a fix — the
                  host asks the assistant to explain in that case. */}
              {topSeverity === 'error'
                ? t('grafana-ui.panel-chrome.fix-with-assistant', 'Fix with Assistant')
                : t('grafana-ui.panel-chrome.explain-with-assistant', 'Explain with Assistant')}
            </Button>
          )}
        </Stack>
        {onInspect && (
          <Button size="sm" variant="secondary" fill="text" icon="arrow-right" onClick={onInspect}>
            {t('grafana-ui.panel-chrome.inspect-errors-notices', 'Inspect')}
          </Button>
        )}
      </div>
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
    </div>
  );

  return (
    <Tooltip content={content} placement="bottom-start" interactive>
      <Button
        variant={topSeverity === 'error' ? 'destructive' : 'secondary'}
        className={topSeverity !== 'error' ? styles[`${topSeverity}Button`] : undefined}
        icon={getSeverityIcon(topSeverity)}
        size="sm"
        aria-label={ariaLabel}
        data-testid={selectors.components.Panels.Panel.status(topSeverity)}
      />
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1),
  }),
  popoverHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    width: '100%',
  }),
  popoverTitle: css({
    color: theme.colors.text.secondary,
  }),
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
