import { type KeyboardEvent, type ReactNode, useEffect, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Box, Divider, FilterInput, Grid, Icon, Label, Stack, Text } from '@grafana/ui';

import { PopupCard } from '../../components/HoverCard';

import { type FilterDefinition } from './filterDefinitions';
import { type FilterIssue } from './parser';

export interface RuleSearchInputProps {
  /** The applied query, as the user typed it. */
  query: string;
  /** Also called with the applied query itself, for example on blur after Enter. */
  onApply: (query: string) => void;
  filters: FilterDefinition[];
  issues?: FilterIssue[];
  /** Rendered beside the input box, so it stays aligned with the box however many issue messages show below. */
  trailing?: ReactNode;
}

const INPUT_ID = 'rule-search-input';
const ISSUES_DESCRIPTION_ID = 'rule-search-input-issues';

/** The typed text is a draft until it is applied. A change to the applied query, such as Back/Forward, replaces it. */
export function RuleSearchInput({ query, onApply, filters, issues = [], trailing }: RuleSearchInputProps) {
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  const handleChange = (value: string) => {
    setDraft(value);
    // An empty input is no search, applied at once, so the clear button resets the list without Enter or a blur.
    if (value === '' && query !== '') {
      onApply(value);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === 'NumpadEnter') {
      event.preventDefault();
      onApply(draft);
    }
  };

  const handleBlur = () => onApply(draft);

  const issueMessages = describeIssues(issues, filters);
  const hasIssues = issueMessages.length > 0;

  return (
    <Stack direction="column" gap={0.5} width="100%">
      <Label htmlFor={INPUT_ID}>
        <Stack gap={0.5} alignItems="center">
          <span>
            <Trans i18nKey="alerting.gma-rule-list.search.label">Search</Trans>
          </span>
          <PopupCard content={<SearchHelp filters={filters} />}>
            <Icon
              name="info-circle"
              size="sm"
              tabIndex={0}
              title={t('alerting.gma-rule-list.search.help-title', 'Search help')}
            />
          </PopupCard>
        </Stack>
      </Label>
      <Stack direction="row" gap={2} alignItems="center">
        <Box grow={1} minWidth={0}>
          <FilterInput
            id={INPUT_ID}
            value={draft}
            escapeRegex={false}
            placeholder={t('alerting.gma-rule-list.search.placeholder', 'Search by name or enter filter query...')}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            aria-invalid={hasIssues || undefined}
            aria-describedby={hasIssues ? ISSUES_DESCRIPTION_ID : undefined}
          />
        </Box>
        {trailing && <Box shrink={0}>{trailing}</Box>}
      </Stack>
      {hasIssues && (
        <div id={ISSUES_DESCRIPTION_ID}>
          {issueMessages.map((message) => (
            <Text key={message} color="error" variant="bodySmall" element="p">
              {message}
            </Text>
          ))}
        </div>
      )}
    </Stack>
  );
}

function describeIssues(issues: FilterIssue[], filters: FilterDefinition[]): string[] {
  const keysWith = (reason: 'invalid' | 'unavailable') => [
    ...new Set(issues.flatMap((issue) => (issue.key !== null && issue.reason === reason ? [issue.key] : []))),
  ];
  const has = (reason: FilterIssue['reason']) => issues.some((issue) => issue.reason === reason);
  const valuesByKey = new Map<string, string[] | undefined>(filters.map(({ key, values }) => [key, values]));
  const messages: string[] = [];

  const invalidKeys = keysWith('invalid');
  const keysWithoutValues = invalidKeys.filter((key) => !valuesByKey.get(key));
  if (keysWithoutValues.length > 0) {
    messages.push(
      t('alerting.gma-rule-list.search.invalid-tokens', 'Some filters could not be applied: {{tokens}}', {
        interpolation: { escapeValue: false },
        tokens: keysWithoutValues.join(', '),
      })
    );
  }
  for (const key of invalidKeys) {
    const values = valuesByKey.get(key);
    if (values) {
      messages.push(
        t('alerting.gma-rule-list.search.invalid-value', 'Use one of these values for {{key}}: {{values}}', {
          interpolation: { escapeValue: false },
          key,
          values: values.join(', '),
        })
      );
    }
  }
  for (const issue of issues) {
    if (issue.reason === 'rejected') {
      messages.push(
        issue.key === null
          ? t('alerting.gma-rule-list.search.rejected-search', 'The search was rejected: {{message}}', {
              interpolation: { escapeValue: false },
              message: issue.message,
            })
          : t('alerting.gma-rule-list.search.rejected-filter', '{{key}} was rejected: {{message}}', {
              interpolation: { escapeValue: false },
              key: issue.key,
              message: issue.message,
            })
      );
    }
    if (issue.reason === 'renamed') {
      messages.push(
        t('alerting.gma-rule-list.search.renamed-value', 'Use {{to}} instead of {{from}}.', {
          interpolation: { escapeValue: false },
          to: `${issue.key}:${issue.to}`,
          from: `${issue.key}:${issue.from}`,
        })
      );
    }
  }
  if (has('unavailable')) {
    messages.push(
      t('alerting.gma-rule-list.search.unavailable-tokens', 'Some filters are not available yet: {{tokens}}', {
        interpolation: { escapeValue: false },
        tokens: keysWith('unavailable').join(', '),
      })
    );
  }
  if (has('wildcardInText')) {
    messages.push(t('alerting.gma-rule-list.search.wildcard-in-text', 'Search text cannot contain * or %.'));
  }
  if (has('unclosedQuote')) {
    messages.push(t('alerting.gma-rule-list.search.unclosed-quote', 'A quote in the search is not closed.'));
  }
  return messages;
}

function SearchHelp({ filters }: { filters: FilterDefinition[] }) {
  return (
    <Stack direction="column" gap={1}>
      <Text element="p">
        <Trans i18nKey="alerting.gma-rule-list.search.help-intro">
          Search syntax allows you to query rules by the filters below.
        </Trans>
      </Text>
      <Divider spacing={0} />
      <Grid columns={3} gap={1} alignItems="center">
        <Text weight="bold">
          <Trans i18nKey="alerting.gma-rule-list.search.help-filter-type">Filter type</Trans>
        </Text>
        <Text weight="bold">
          <Trans i18nKey="alerting.gma-rule-list.search.help-expression">Expression</Trans>
        </Text>
        <Text weight="bold">
          <Trans i18nKey="alerting.gma-rule-list.search.help-availability">Availability</Trans>
        </Text>
        {filters.map((definition) => (
          <HelpRow key={definition.key} definition={definition} />
        ))}
      </Grid>
    </Stack>
  );
}

function HelpRow({ definition }: { definition: FilterDefinition }) {
  return (
    <>
      <Stack direction="column" gap={0.25}>
        <Text weight="medium">{definition.label()}</Text>
        <Text element="span" variant="bodySmall" color="secondary">
          {definition.description()}
        </Text>
      </Stack>
      <code>{definition.example}</code>
      <HelpAvailability definition={definition} />
    </>
  );
}

function HelpAvailability({ definition }: { definition: FilterDefinition }) {
  const { unavailableValues = [] } = definition;

  return (
    <Stack direction="column" gap={0.25}>
      <Text element="span">
        <Trans i18nKey="alerting.gma-rule-list.search.help-available">Available</Trans>
      </Text>
      {unavailableValues.map(({ value, reason }) => (
        <Text key={value} element="span" variant="bodySmall" color="secondary">
          {reason()}
        </Text>
      ))}
    </Stack>
  );
}
