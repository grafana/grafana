import { isEqual } from 'lodash';
import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Combobox, Field, IconButton, Input, Stack } from '@grafana/ui';

import { type SearchLabelMatcher } from './sharedRuleFilter';

/**
 * Label matcher rows. A row is sent once complete: a key and a value, or a key with exists or absent. Incomplete
 * rows stay here but out of the search, so the list doesn't empty while the user types.
 */
export function LabelMatchersFilter({
  labels,
  onChange,
}: {
  labels: SearchLabelMatcher[];
  onChange: (labels: SearchLabelMatcher[]) => void;
}) {
  const [rows, setRows] = useState(labels);
  const [sent, setSent] = useState(labels);
  // The labels changed elsewhere, in the search box or through Back, so they replace the rows.
  if (!isEqual(labels, sent)) {
    setSent(labels);
    setRows(labels);
  }

  const update = (next: SearchLabelMatcher[], { apply = true } = {}) => {
    setRows(next);
    const complete = next
      .filter(isComplete)
      .map(({ key, operator, value }) =>
        operator === 'exists' || operator === 'absent' ? { key, operator } : { key, operator, value }
      );
    if (apply && !isEqual(complete, sent)) {
      setSent(complete);
      onChange(complete);
    }
  };
  const edit = (index: number, change: Partial<SearchLabelMatcher>, options?: { apply: boolean }) =>
    update(
      rows.map((row, i) => (i === index ? { ...row, ...change } : row)),
      options
    );
  const applyRows = () => update(rows);

  return (
    <Field noMargin label={t('alerting.gma-rule-list.sidebar.labels', 'Labels')} useFieldset>
      <Stack direction="column" gap={1}>
        {rows.map((row, index) => (
          // Rows have no identity of their own, and their inputs hold no state, so the index is a safe key.
          // eslint-disable-next-line react/no-array-index-key
          <Stack key={index} direction="row" gap={0.5} alignItems="center">
            <Input
              aria-label={t('alerting.gma-rule-list.sidebar.label-key', 'Label key')}
              placeholder={t('alerting.gma-rule-list.sidebar.label-key-placeholder', 'key')}
              value={row.key}
              onChange={(event) => edit(index, { key: event.currentTarget.value }, { apply: false })}
              onBlur={applyRows}
              onKeyDown={(event) => event.key === 'Enter' && applyRows()}
            />
            <Combobox
              aria-label={t('alerting.gma-rule-list.sidebar.label-operator', 'Operator')}
              width={8}
              options={OPERATORS}
              value={row.operator}
              onChange={(option) => edit(index, { operator: option.value })}
            />
            {row.operator !== 'exists' && row.operator !== 'absent' && (
              <Input
                aria-label={t('alerting.gma-rule-list.sidebar.label-value', 'Label value')}
                placeholder={t('alerting.gma-rule-list.sidebar.label-value-placeholder', 'value')}
                value={row.value ?? ''}
                onChange={(event) => edit(index, { value: event.currentTarget.value }, { apply: false })}
                onBlur={applyRows}
                onKeyDown={(event) => event.key === 'Enter' && applyRows()}
              />
            )}
            <IconButton
              name="times"
              tooltip={t('alerting.gma-rule-list.sidebar.label-remove', 'Remove label matcher')}
              onClick={() => update(rows.filter((_, i) => i !== index))}
            />
          </Stack>
        ))}
        <Button
          size="sm"
          variant="secondary"
          icon="plus"
          onClick={() => update([...rows, { key: '', operator: 'equal', value: '' }], { apply: false })}
        >
          <Trans i18nKey="alerting.gma-rule-list.sidebar.label-add">Add label</Trans>
        </Button>
      </Stack>
    </Field>
  );
}

function isComplete({ key, operator, value }: SearchLabelMatcher): boolean {
  return key.length > 0 && (operator === 'exists' || operator === 'absent' || Boolean(value));
}

const OPERATORS: Array<{ label: string; value: SearchLabelMatcher['operator'] }> = [
  { label: '=', value: 'equal' },
  { label: '!=', value: 'notEqual' },
  { label: '=~', value: 'regex' },
  { label: '!~', value: 'notRegex' },
  { label: 'exists', value: 'exists' },
  { label: 'absent', value: 'absent' },
];
