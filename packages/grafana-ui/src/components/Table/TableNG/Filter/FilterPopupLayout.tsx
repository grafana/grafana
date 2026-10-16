import { css } from '@emotion/css';
import { type ReactNode, type Ref } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Button } from '../../../Button/Button';
import { Stack } from '../../../Layout/Stack/Stack';
import { Text } from '../../../Text/Text';

interface FilterPopupLayoutProps {
  children: ReactNode;
  containerRef: Ref<HTMLDivElement>;
  width?: number;
  maxWidth?: number;
}

export function FilterPopupLayout({ children, containerRef, width, maxWidth }: FilterPopupLayoutProps) {
  const styles = useStyles2(getStyles);

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={width || maxWidth ? { width, maxWidth } : undefined}
      data-testid={selectors.components.Panels.Visualization.TableNG.Filters.Container}
    >
      <Stack direction="column" gap={1.5}>
        {children}
      </Stack>
    </div>
  );
}

interface FilterPopupFooterProps {
  selectedRows: number;
  totalRows: number;
  onClear?: () => void;
  onCancel: () => void;
  onApply: () => void;
  applyLabel: ReactNode;
  applyDisabled?: boolean;
  clearTestId?: string;
  cancelTestId?: string;
  applyTestId?: string;
}

export function FilterPopupFooter({
  selectedRows,
  totalRows,
  onClear,
  onCancel,
  onApply,
  applyLabel,
  applyDisabled,
  clearTestId,
  cancelTestId,
  applyTestId,
}: FilterPopupFooterProps) {
  return (
    <Stack direction="row" wrap alignItems="center" justifyContent="space-between" gap={1}>
      <Text variant="bodySmall" color="secondary" role="status">
        {t('grafana-ui.table.filter-popup-row-count', '{{selected}} of {{total}} rows', {
          selected: formatRowCount(selectedRows),
          total: formatRowCount(totalRows),
        })}
      </Text>
      <Stack direction="row" wrap alignItems="center" justifyContent="flex-end" gap={1} grow={1}>
        {onClear && (
          <Button size="sm" fill="text" onClick={onClear} data-testid={clearTestId}>
            <Trans i18nKey="grafana-ui.table.filter-popup-clear">Clear filter</Trans>
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={onCancel} data-testid={cancelTestId}>
          <Trans i18nKey="grafana-ui.table.filter-popup-cancel">Cancel</Trans>
        </Button>
        <Button size="sm" disabled={applyDisabled} onClick={onApply} data-testid={applyTestId}>
          {applyLabel}
        </Button>
      </Stack>
    </Stack>
  );
}

const compactCount = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatRowCount(count: number): string {
  return count > 1000 ? compactCount.format(count).replace('K', 'k') : String(count);
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    label: 'filterContainer',
    width: 'fit-content',
    minWidth: 240,
    maxWidth: 360,
    boxSizing: 'border-box',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(2),
    boxShadow: theme.flags.visualDesignRefresh ? theme.shadows.z2 : theme.shadows.z3,
    borderRadius: theme.shape.radius.default,
  }),
});
