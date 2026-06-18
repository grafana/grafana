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

import { type PanelStatusItem, type PanelStatusSeverity } from './types';

export interface Props {
  /** Single status message (legacy). Used when `items` is not provided. */
  message?: string;
  /** Structured list of errors and notices to show in the status popover. */
  items?: PanelStatusItem[];
  /** Opens the inspector "Errors and notices" tab. */
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
  if (items && items.length > 0) {
    return <PanelStatusPopover items={items} onInspect={onClick} ariaLabel={ariaLabel} />;
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
}

function PanelStatusPopover({ items, onInspect, ariaLabel }: PanelStatusPopoverProps) {
  const styles = useStyles2(getStyles);
  const topSeverity = getTopSeverity(items);

  const content = (
    <Stack direction="column" gap={1}>
      {items.map((item, index) => (
        <div key={`${item.severity}-${index}`} className={styles.item}>
          <Icon name={getSeverityIcon(item.severity)} className={styles[item.severity]} size="sm" />
          <span className={styles.itemText}>{item.text}</span>
        </div>
      ))}
    </Stack>
  );

  const title = (
    <div className={styles.popoverHeader}>
      <span>{t('grafana-ui.panel-chrome.errors-and-notices', 'Errors and notices')}</span>
      {onInspect && (
        <Button size="sm" variant="secondary" fill="text" icon="arrow-right" onClick={onInspect}>
          {t('grafana-ui.panel-chrome.inspect-errors-notices', 'Inspect')}
        </Button>
      )}
    </div>
  );

  return (
    <Toggletip
      title={title}
      content={content}
      placement="bottom-start"
      closeButton={false}
      fitContent
    >
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
  popoverHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    width: '100%',
  }),
  item: css({
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    maxWidth: theme.spacing(40),
  }),
  itemText: css({
    minWidth: 0,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  error: css({
    color: theme.colors.error.text,
    flexShrink: 0,
  }),
  warning: css({
    color: theme.colors.warning.text,
    flexShrink: 0,
  }),
  info: css({
    color: theme.colors.info.text,
    flexShrink: 0,
  }),
  warningButton: css({
    color: theme.colors.warning.text,
  }),
  infoButton: css({
    color: theme.colors.info.text,
  }),
});
