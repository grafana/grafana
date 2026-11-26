import { isEqual } from 'lodash';
import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Box, Button, Combobox, type ComboboxOption, IconButton, Input, Stack } from '@grafana/ui';

import { SidebarField } from '../../rule-list/filter/RulesFilterSidebar';

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
      .map(({ key, operator, value }) => (takesValue(operator) ? { key, operator, value } : { key, operator }));
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
    <SidebarField label={t('alerting.gma-rule-list.sidebar.labels', 'Labels')}>
      <Stack direction="column" gap={1}>
        {rows.map((row, index) => (
          // Rows have no identity of their own, and their inputs hold no state, so the index is a safe key.
          // eslint-disable-next-line react/no-array-index-key
          <Stack key={index} direction="row" gap={0.5} alignItems="center">
            <Box grow={1} minWidth={8}>
              <Input
                aria-label={t('alerting.gma-rule-list.sidebar.label-key', 'Label key')}
                placeholder={t('alerting.gma-rule-list.sidebar.label-key-placeholder', 'key')}
                value={row.key}
                onChange={(event) => edit(index, { key: event.currentTarget.value }, { apply: false })}
                onBlur={applyRows}
                onKeyDown={(event) => event.key === 'Enter' && applyRows()}
              />
            </Box>
            <Box shrink={0}>
              <Combobox
                aria-label={t('alerting.gma-rule-list.sidebar.label-operator', 'Operator')}
                width="auto"
                minWidth={8}
                options={getOperators()}
                value={row.operator}
                onChange={(option) => edit(index, { operator: option.value })}
              />
            </Box>
            <Box grow={1} minWidth={8}>
              <Input
                aria-label={t('alerting.gma-rule-list.sidebar.label-value', 'Label value')}
                placeholder={getValuePlaceholder(row.operator)}
                disabled={!takesValue(row.operator)}
                value={takesValue(row.operator) ? (row.value ?? '') : ''}
                onChange={(event) => edit(index, { value: event.currentTarget.value }, { apply: false })}
                onBlur={applyRows}
                onKeyDown={(event) => event.key === 'Enter' && applyRows()}
              />
            </Box>
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
    </SidebarField>
  );
}

function isComplete({ key, operator, value }: SearchLabelMatcher): boolean {
  return key.length > 0 && (!takesValue(operator) || Boolean(value));
}

/** exists and absent match on the key alone. */
function takesValue(operator: SearchLabelMatcher['operator']): boolean {
  return operator !== 'exists' && operator !== 'absent';
}

function getValuePlaceholder(operator: SearchLabelMatcher['operator']): string {
  if (operator === 'exists') {
    return t('alerting.gma-rule-list.sidebar.label-value-any', 'any');
  }
  if (operator === 'absent') {
    return t('alerting.gma-rule-list.sidebar.label-value-unset', 'none');
  }
  return t('alerting.gma-rule-list.sidebar.label-value-placeholder', 'value');
}

function getOperators(): Array<ComboboxOption<SearchLabelMatcher['operator']>> {
  return [
    { label: '=', value: 'equal', description: t('alerting.gma-rule-list.sidebar.operator-equal', 'Equals') },
    {
      label: '!=',
      value: 'notEqual',
      description: t('alerting.gma-rule-list.sidebar.operator-not-equal', 'Does not equal'),
    },
    { label: '=~', value: 'regex', description: t('alerting.gma-rule-list.sidebar.operator-regex', 'Matches regex') },
    {
      label: '!~',
      value: 'notRegex',
      description: t('alerting.gma-rule-list.sidebar.operator-not-regex', 'Does not match regex'),
    },
    {
      label: t('alerting.gma-rule-list.sidebar.operator-exists', 'exists'),
      value: 'exists',
      description: t('alerting.gma-rule-list.sidebar.operator-exists-description', 'Has this label'),
    },
    {
      label: t('alerting.gma-rule-list.sidebar.operator-absent', 'absent'),
      value: 'absent',
      description: t('alerting.gma-rule-list.sidebar.operator-absent-description', 'Lacks this label'),
    },
  ];
}
