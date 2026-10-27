import { type KeyboardEventHandler, type ReactNode, type Ref } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';

import { useTheme2 } from '../../../../themes/ThemeContext';
import { Button } from '../../../Button/Button';
import { Box } from '../../../Layout/Box/Box';
import { Stack } from '../../../Layout/Stack/Stack';
import { Text } from '../../../Text/Text';

interface FilterPopupLayoutProps {
  children: ReactNode;
  containerRef: Ref<HTMLDivElement>;
  width?: number;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}

export function FilterPopupLayout({ children, containerRef, width, onKeyDown }: FilterPopupLayoutProps) {
  const theme = useTheme2();

  return (
    // Handle Escape from child controls before the table header stops keyboard propagation.
    <Box
      ref={containerRef}
      onKeyDown={onKeyDown}
      width={width ? `${width}px` : 'fit-content'}
      minWidth="280px"
      maxWidth="360px"
      backgroundColor="elevated"
      borderColor="weak"
      borderStyle="solid"
      borderRadius={theme.components.menu.borderRadius}
      boxShadow={theme.flags.visualDesignRefresh ? 'z2' : 'z3'}
      padding={2}
      data-testid={selectors.components.Panels.Visualization.TableNG.Filters.Container}
    >
      <Stack direction="column" gap={1.5}>
        {children}
      </Stack>
    </Box>
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
