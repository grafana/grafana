import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Divider, FilterInput, Grid, Icon, Label, Stack, Text } from '@grafana/ui';

import { PopupCard } from '../../components/HoverCard';

import { type FilterDefinition } from './filterDefinitions';
import { type FilterIssue } from './filterIssues';
import { parse } from './parser';
import { serialize } from './serializer';

export interface RuleSearchInputProps {
  /** The canonical form of the applied query. */
  query: string;
  onApply: (query: string) => void;
  filters: FilterDefinition[];
  issues?: FilterIssue[];
}

const INPUT_ID = 'rule-search-input';
const ISSUES_DESCRIPTION_ID = 'rule-search-input-issues';

/**
 * The typed text is a draft, applied on Enter or blur, or at once when the input is emptied. It is replaced only when the query changes
 * elsewhere (sidebar, saved search), never by the canonical form of our own apply.
 */
export function RuleSearchInput({ query, onApply, filters, issues = [] }: RuleSearchInputProps) {
  const [draft, setDraft] = useState(query);
  const lastAppliedText = useRef(query);

  const canonicalize = useCallback((text: string) => serialize(parse(text, filters), filters), [filters]);

  useEffect(() => {
    // The canonical form of what we last applied is an echo of our own apply, so the draft stays as typed.
    if (query === canonicalize(lastAppliedText.current)) {
      return;
    }
    lastAppliedText.current = query;
    setDraft(query);
  }, [query, canonicalize]);

  const apply = (text: string) => {
    // Re-applying text that is already applied would add a history entry for nothing.
    if (canonicalize(text) === query) {
      return;
    }
    lastAppliedText.current = text;
    onApply(text);
  };

  const handleChange = (value: string) => {
    setDraft(value);
    // An empty input is no search, applied at once, so the clear button resets the list without Enter or a blur.
    if (value === '') {
      apply(value);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === 'NumpadEnter') {
      event.preventDefault();
      apply(draft);
    }
  };

  const handleBlur = () => apply(draft);

  const invalidKeys = [
    ...new Set(issues.filter((issue) => issue.reason !== 'wildcardInText').map((issue) => issue.key)),
  ];
  const hasWildcardInText = issues.some((issue) => issue.reason === 'wildcardInText');
  const hasIssues = issues.length > 0;

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
      {hasIssues && (
        <div id={ISSUES_DESCRIPTION_ID}>
          {invalidKeys.length > 0 && (
            <Text color="error" variant="bodySmall" element="p">
              <Trans i18nKey="alerting.gma-rule-list.search.invalid-tokens">
                Some filters could not be applied: {{ tokens: invalidKeys.join(', ') }}
              </Trans>
            </Text>
          )}
          {hasWildcardInText && (
            <Text color="error" variant="bodySmall" element="p">
              <Trans i18nKey="alerting.gma-rule-list.search.wildcard-in-text">Search text cannot contain * or %.</Trans>
            </Text>
          )}
        </div>
      )}
    </Stack>
  );
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
