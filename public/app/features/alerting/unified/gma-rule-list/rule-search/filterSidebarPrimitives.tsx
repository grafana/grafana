import { type KeyboardEvent, useEffect, useId, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import {
  Button,
  Combobox,
  type ComboboxOption,
  Icon,
  IconButton,
  Input,
  RadioButtonGroup,
  Stack,
  Switch,
  Text,
} from '@grafana/ui';

import { type Criteria, type HealthValue, type LabelMatcher, type LabelOperator } from './criteria';

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
 *
 * A row added with "Add label filter" lives only here until it has a key; applying it earlier
 * would put an empty-key matcher in the URL and the request.
 */
export function LabelMatchersEditor({ labels, onChange }: LabelMatchersEditorProps) {
  const [newRow, setNewRow] = useState<LabelMatcher>();

  const updateRow = (index: number, next: LabelMatcher) => {
    // An applied row cannot lose its key; the row resets to it instead.
    if (next.key) {
      onChange(labels.map((row, i) => (i === index ? next : row)));
    }
  };

  const updateNewRow = (next: LabelMatcher) => {
    if (next.key) {
      setNewRow(undefined);
      onChange([...labels, next]);
    } else {
      setNewRow(next);
    }
  };

  return (
    <Stack direction="column" gap={1}>
      {labels.map((label, index) => (
        <LabelMatcherRow
          key={index}
          matcher={label}
          onChange={(next) => updateRow(index, next)}
          onRemove={() => onChange(labels.filter((_, i) => i !== index))}
        />
      ))}
      {/* Keyed like the applied row it becomes, so entering its key does not remount the inputs and drop focus. */}
      {newRow && (
        <LabelMatcherRow
          key={labels.length}
          matcher={newRow}
          onChange={updateNewRow}
          onRemove={() => setNewRow(undefined)}
        />
      )}
      <Button
        size="sm"
        variant="secondary"
        fill="outline"
        icon="plus"
        disabled={Boolean(newRow)}
        onClick={() => setNewRow({ key: '', operator: 'equal', value: '' })}
      >
        {t('alerting.gma-rule-list.search.label-add', 'Add label filter')}
      </Button>
    </Stack>
  );
}

interface LabelMatcherRowProps {
  matcher: LabelMatcher;
  onChange: (matcher: LabelMatcher) => void;
  onRemove: () => void;
}

/** Key and value apply on blur or Enter, like the rule title field, so typing a label does not
 * change the URL and the request on every keystroke. The operator applies immediately. */
function LabelMatcherRow({ matcher, onChange, onRemove }: LabelMatcherRowProps) {
  const [key, setKey] = useState(matcher.key);
  const [value, setValue] = useState(matcher.value ?? '');

  useEffect(() => setKey(matcher.key), [matcher.key]);
  useEffect(() => setValue(matcher.value ?? ''), [matcher.value]);

  const commitKey = () => {
    const trimmed = key.trim();
    if (trimmed !== matcher.key) {
      onChange({ ...matcher, key: trimmed });
    }
    if (!trimmed) {
      setKey(matcher.key);
    }
  };

  const commitValue = () => {
    if (value !== (matcher.value ?? '')) {
      onChange({ ...matcher, value });
    }
  };

  const commitOnEnter = (commit: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commit();
    }
  };

  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      <Input
        aria-label={t('alerting.gma-rule-list.search.label-key', 'Label key')}
        placeholder={t('alerting.gma-rule-list.search.label-key-placeholder', 'key')}
        value={key}
        onChange={(e) => setKey(e.currentTarget.value)}
        onBlur={commitKey}
        onKeyDown={commitOnEnter(commitKey)}
      />
      <RadioButtonGroup
        aria-label={t('alerting.gma-rule-list.search.label-operator', 'Label operator')}
        options={getOperatorOptions()}
        value={matcher.operator}
        onChange={(operator) =>
          onChange({ ...matcher, operator, value: VALUELESS_OPERATORS.has(operator) ? undefined : value })
        }
      />
      {!VALUELESS_OPERATORS.has(matcher.operator) && (
        <Input
          aria-label={t('alerting.gma-rule-list.search.label-value', 'Label value')}
          placeholder={t('alerting.gma-rule-list.search.label-value-placeholder', 'value')}
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onBlur={commitValue}
          onKeyDown={commitOnEnter(commitValue)}
        />
      )}
      <IconButton
        name="trash-alt"
        aria-label={t('alerting.gma-rule-list.search.label-remove', 'Remove label filter')}
        onClick={onRemove}
      />
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
    <Input
      aria-label={t('alerting.gma-rule-list.search.property.rule-name', 'Rule name')}
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
  );
}

export function InvalidTokenNote() {
  return (
    <Text color="error" variant="bodySmall">
      <Trans i18nKey="alerting.gma-rule-list.search.property.invalid">
        This filter is not valid — showing no results until this is fixed.
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

export function UnavailableFilterNote({ reason }: { reason: string }) {
  return (
    <Stack gap={0.5} alignItems="center">
      <Icon name="info-circle" size="sm" />
      <Text color="secondary" variant="bodySmall">
        {reason}
      </Text>
    </Stack>
  );
}

type HealthOption = HealthValue | 'any';

function getHealthOptions(): Array<ComboboxOption<HealthOption>> {
  return [
    { label: t('alerting.gma-rule-list.search.health-any', 'Any'), value: 'any' },
    { label: t('alerting.gma-rule-list.search.health-ok', 'OK'), value: 'ok' },
    { label: t('alerting.gma-rule-list.search.health-nodata', 'No data'), value: 'nodata' },
    { label: t('alerting.gma-rule-list.search.health-error', 'Error'), value: 'error' },
    { label: t('alerting.gma-rule-list.search.health-unknown', 'Unknown'), value: 'unknown' },
  ];
}

export interface HealthFieldProps {
  value: HealthValue | undefined;
  onChange: (value: HealthValue | undefined) => void;
}

/** Health control shared by both pages; a rule with no stored status matches none of its values. */
export function HealthField({ value, onChange }: HealthFieldProps) {
  return (
    <Combobox<HealthOption>
      aria-label={t('alerting.gma-rule-list.search.property.health', 'Health')}
      options={getHealthOptions()}
      // `err` is an accepted spelling of `error`; both select the same option.
      value={value === 'err' ? 'error' : (value ?? 'any')}
      onChange={(option) => onChange(!option || option.value === 'any' ? undefined : option.value)}
    />
  );
}
