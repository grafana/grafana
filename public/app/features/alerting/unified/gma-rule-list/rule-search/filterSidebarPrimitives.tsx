import { type ReactNode, useEffect, useId, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Box, Button, Icon, IconButton, Input, Label, RadioButtonGroup, Stack, Switch, Text } from '@grafana/ui';

import { type Criteria, type LabelMatcher, type LabelOperator } from './criteria';

// Box's `width` is a spacing-token multiplier for numbers (theme.spacing(n)), not a literal
// pixel value — a plain CSS length string passes through unchanged instead.
const SIDEBAR_WIDTH = '250px';

export function FilterSidebarContainer({ children }: { children: ReactNode }) {
  return (
    <Box width={SIDEBAR_WIDTH} shrink={0}>
      {children}
    </Box>
  );
}

export function SidebarSection({ children }: { children: ReactNode }) {
  return (
    <Stack direction="column" gap={1.5}>
      {children}
    </Stack>
  );
}

export interface SidebarFieldProps {
  label: ReactNode;
  children: ReactNode;
  labelId?: string;
  /** Shown under the label, e.g. "Coming soon" or "Requires a dashboard". */
  note?: ReactNode;
}

export function SidebarField({ label, children, labelId, note }: SidebarFieldProps) {
  return (
    <Stack direction="column" gap={0.5}>
      <Label id={labelId}>{label}</Label>
      {children}
      {note}
    </Stack>
  );
}

function getOperatorOptions(): Array<{ label: string; value: LabelOperator }> {
  return [
    { label: '=', value: 'equal' },
    { label: '!=', value: 'notEqual' },
    { label: '=~', value: 'regex' },
    { label: '!~', value: 'notRegex' },
    { label: t('alerting.gma-rule-list.search.label-operator-exists', 'exists'), value: 'exists' },
    { label: t('alerting.gma-rule-list.search.label-operator-absent', 'absent'), value: 'absent' },
  ];
}

const VALUELESS_OPERATORS = new Set<LabelOperator>(['exists', 'absent']);

export interface LabelMatchersEditorProps {
  labels: LabelMatcher[];
  onChange: (labels: LabelMatcher[]) => void;
}

/**
 * Manual key/operator/value editor for label matchers. No suggestion fetch: complete label
 * suggestions need a bounded, authorized backend source that doesn't exist yet, so this only
 * ever accepts what the user types.
 */
export function LabelMatchersEditor({ labels, onChange }: LabelMatchersEditorProps) {
  const updateRow = (index: number, next: Partial<LabelMatcher>) => {
    const updated = labels.map((row, i) => (i === index ? { ...row, ...next } : row));
    onChange(updated);
  };

  const removeRow = (index: number) => {
    onChange(labels.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange([...labels, { key: '', operator: 'equal', value: '' }]);
  };

  return (
    <Stack direction="column" gap={1}>
      {labels.map((label, index) => (
        <Stack key={index} direction="row" gap={0.5} alignItems="center">
          <Input
            aria-label={t('alerting.gma-rule-list.search.label-key', 'Label key')}
            placeholder={t('alerting.gma-rule-list.search.label-key-placeholder', 'key')}
            value={label.key}
            onChange={(e) => updateRow(index, { key: e.currentTarget.value })}
          />
          <RadioButtonGroup
            aria-label={t('alerting.gma-rule-list.search.label-operator', 'Label operator')}
            options={getOperatorOptions()}
            value={label.operator}
            onChange={(operator) =>
              updateRow(index, { operator, value: VALUELESS_OPERATORS.has(operator) ? undefined : (label.value ?? '') })
            }
          />
          {!VALUELESS_OPERATORS.has(label.operator) && (
            <Input
              aria-label={t('alerting.gma-rule-list.search.label-value', 'Label value')}
              placeholder={t('alerting.gma-rule-list.search.label-value-placeholder', 'value')}
              value={label.value ?? ''}
              onChange={(e) => updateRow(index, { value: e.currentTarget.value })}
            />
          )}
          <IconButton
            name="trash-alt"
            aria-label={t('alerting.gma-rule-list.search.label-remove', 'Remove label filter')}
            onClick={() => removeRow(index)}
          />
        </Stack>
      ))}
      <Button size="sm" variant="secondary" fill="outline" icon="plus" onClick={addRow}>
        {t('alerting.gma-rule-list.search.label-add', 'Add label filter')}
      </Button>
    </Stack>
  );
}

export function RuleTitleField({ criteria, onChange }: { criteria: Criteria; onChange: (criteria: Criteria) => void }) {
  // The title field is a single free-text value even though `criteria.text` is an array
  // (it also carries any free words typed into the main search input) — both end up in the
  // same request text leaf, so collapsing them into one editable string here is safe.
  const appliedValue = criteria.text.join(' ');
  const [draft, setDraft] = useState(appliedValue);

  useEffect(() => {
    setDraft(appliedValue);
  }, [appliedValue]);

  const apply = () => {
    onChange({ ...criteria, text: draft.trim() ? [draft.trim()] : [] });
  };

  return (
    <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.rule-name">Rule name</Trans>}>
      <Input
        value={draft}
        placeholder={t('alerting.gma-rule-list.search.rule-name-placeholder', 'Filter by name...')}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            apply();
          }
        }}
      />
    </SidebarField>
  );
}

export function InvalidTokenNote() {
  return (
    <Text color="error" variant="bodySmall">
      <Trans i18nKey="alerting.gma-rule-list.search.property.unresolved">
        Could not be resolved — showing no results until this is fixed.
      </Trans>
    </Text>
  );
}

export interface SwitchFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

/**
 * A Switch with the label actually visible on screen. Switch's own `label` prop only sets
 * `aria-label` on an empty `<label>` — sighted users see no text at all — so this pairs it
 * with a clickable, visible text node wired to the same control.
 */
export function SwitchField({ label, value, onChange, disabled }: SwitchFieldProps) {
  const id = useId();
  return (
    <Stack gap={1} alignItems="center">
      {/* No `label` prop here: it would only set aria-label on top of the visible <label>
       * below, doubling the computed accessible name. */}
      <Switch id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} />
      {/* A native <label htmlFor> toggles the switch on click without extra handlers, and
       * gives the switch its accessible name via label association instead of aria-label. */}
      <label htmlFor={id}>
        <Text element="span" color={disabled ? 'disabled' : 'primary'}>
          {label}
        </Text>
      </label>
    </Stack>
  );
}

export function PendingFilterNote() {
  return (
    <Stack gap={0.5} alignItems="center">
      <Icon name="info-circle" size="sm" />
      <Text color="secondary" variant="bodySmall">
        <Trans i18nKey="alerting.gma-rule-list.search.property.pending-note">
          Filtering by this isn&apos;t available yet.
        </Trans>
      </Text>
    </Stack>
  );
}
