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

/** No suggestions yet (no bounded, authorized backend source). A new row stays local until it has a key. */
export function LabelMatchersEditor({ labels, onChange }: LabelMatchersEditorProps) {
  const [newRow, setNewRow] = useState<LabelMatcher>();

  const updateRow = (index: number, next: LabelMatcher) => {
    // An applied row cannot lose its key.
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
      {/* Keyed like the applied row it becomes, so entering a key keeps focus. */}
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

/** Key and value apply on blur or Enter, not per keystroke; the operator applies immediately. */
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
  // `criteria.text` is an array, but all entries share one request text leaf, so one string is safe.
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

/** Switch's own `label` prop is not visible text, so this adds a visible, clickable label. */
export function SwitchField({ label, value, onChange, disabled }: SwitchFieldProps) {
  const id = useId();
  return (
    <Stack gap={1} alignItems="center">
      {/* No `label` prop: it would double the accessible name. */}
      <Switch id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} />
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

export function HealthField({ value, onChange }: HealthFieldProps) {
  return (
    <Combobox<HealthOption>
      aria-label={t('alerting.gma-rule-list.search.property.health', 'Health')}
      options={getHealthOptions()}
      // `err` is an alias of `error`.
      value={value === 'err' ? 'error' : (value ?? 'any')}
      onChange={(option) => onChange(!option || option.value === 'any' ? undefined : option.value)}
    />
  );
}
