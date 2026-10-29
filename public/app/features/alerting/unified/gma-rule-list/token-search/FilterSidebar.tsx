import { type ReactNode, useId } from 'react';

import { Trans } from '@grafana/i18n';
import { Box, Button, Label, Stack } from '@grafana/ui';

import { type TokenDefinition } from './tokens';

// Box `width` numbers are spacing multipliers, not pixels; a CSS length string passes through.
const SIDEBAR_WIDTH = '250px';

export interface SidebarControl {
  render: () => ReactNode;
  /** For controls that cannot take an `aria-label` themselves. */
  controlId?: string;
  note?: ReactNode;
}

export interface FilterSidebarProps {
  definitions: TokenDefinition[];
  controls: Record<string, SidebarControl>;
  onClear: () => void;
  hasActiveFilters: boolean;
}

export function FilterSidebar({ definitions, controls, onClear, hasActiveFilters }: FilterSidebarProps) {
  return (
    <Box width={SIDEBAR_WIDTH} shrink={0}>
      <Stack direction="column" gap={0}>
        <Stack direction="row" justifyContent="flex-end">
          <Button size="sm" variant="primary" fill="text" onClick={onClear} disabled={!hasActiveFilters}>
            <Trans i18nKey="alerting.gma-rule-list.search.clear-filters">Clear filters</Trans>
          </Button>
        </Stack>
        <Stack direction="column" gap={2}>
          {definitions.map((definition) => {
            const control = controls[definition.key];
            return control ? <SidebarField key={definition.key} label={definition.label()} control={control} /> : null;
          })}
        </Stack>
      </Stack>
    </Box>
  );
}

function SidebarField({ label, control }: { label: string; control: SidebarControl }) {
  const labelId = useId();

  return (
    <Stack direction="column" gap={0.5} role="group" aria-labelledby={labelId}>
      <Label id={labelId} htmlFor={control.controlId}>
        {label}
      </Label>
      {control.render()}
      {control.note}
    </Stack>
  );
}
