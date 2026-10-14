import { useCallback, useEffect, useRef, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { FilterInput, Grid, Icon, Label, Stack, Text } from '@grafana/ui';

import { PopupCard } from '../../components/HoverCard';

import { type CriteriaIssue } from './criteriaIssues';
import { parse } from './parser';
import { serialize } from './serializer';
import { type TokenDefinition } from './tokens';

export interface RuleSearchInputProps {
  /** The applied canonical query — the full serialized criteria, not just free text. */
  query: string;
  /** Called with the typed text on a debounced valid edit, and immediately on Enter or blur. */
  onApply: (query: string) => void;
  /** This page's token registry, used to generate the help popover. */
  tokens: TokenDefinition[];
  /** Filters that could not be applied, to describe accessibly — from getCriteriaIssues(). */
  issues?: CriteriaIssue[];
  debounceMs?: number;
  id?: string;
}

const DEFAULT_DEBOUNCE_MS = 400;
const ISSUES_DESCRIPTION_ID = 'rule-search-input-issues';

/**
 * Free-text + filter-syntax search input shared by the Alert and Recording pages. The typed
 * text is a local draft: applying it parses the text into criteria for the URL, but the input
 * never takes the canonical form back, so typing never reorders tokens or drops unfinished ones.
 * The draft is replaced only when the applied query changes for another reason (sidebar edit,
 * saved search, Clear filters, browser navigation).
 */
export function RuleSearchInput({
  query,
  onApply,
  tokens,
  issues = [],
  debounceMs = DEFAULT_DEBOUNCE_MS,
  id = 'rule-search-input',
}: RuleSearchInputProps) {
  const [draft, setDraft] = useState(query);
  const draftRef = useRef(query);
  // The last text this component applied. A `query` that is its canonical form is an echo of
  // our own apply, not an outside change.
  const lastAppliedRef = useRef(query);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const canonicalize = useCallback((text: string) => serialize(parse(text, tokens).criteria), [tokens]);

  useEffect(() => {
    if (query === canonicalize(lastAppliedRef.current)) {
      return;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    lastAppliedRef.current = query;
    draftRef.current = query;
    setDraft(query);
  }, [query, canonicalize]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const apply = useCallback(
    (value: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      lastAppliedRef.current = value;
      onApply(value);
    },
    [onApply]
  );

  const handleChange = (value: string) => {
    draftRef.current = value;
    setDraft(value);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // A half-typed filter would only flash an invalid-filter state, so only complete text is
    // applied while typing; Enter and blur apply whatever is there.
    if (parse(value, tokens).criteria.invalid.length === 0) {
      timeoutRef.current = setTimeout(() => apply(value), debounceMs);
    }
  };

  const invalidKeys = [...new Set(issues.map((issue) => issue.key))];
  const hasIssues = invalidKeys.length > 0;

  return (
    <Stack direction="column" gap={0.5} width="100%">
      <Label htmlFor={id}>
        <Stack gap={0.5} alignItems="center">
          <span>
            <Trans i18nKey="alerting.gma-rule-list.search.label">Search</Trans>
          </span>
          <PopupCard content={<SearchHelp tokens={tokens} />}>
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
        id={id}
        value={draft}
        escapeRegex={false}
        placeholder={t('alerting.gma-rule-list.search.placeholder', 'Search by name or enter filter query...')}
        onChange={handleChange}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'NumpadEnter') {
            event.preventDefault();
            apply(draft);
          }
        }}
        onBlur={() => {
          if (canonicalize(draft) !== query) {
            apply(draft);
          }
        }}
        aria-invalid={hasIssues || undefined}
        aria-describedby={hasIssues ? ISSUES_DESCRIPTION_ID : undefined}
      />
      {hasIssues && (
        <Text id={ISSUES_DESCRIPTION_ID} color="error" variant="bodySmall" element="p">
          <Trans i18nKey="alerting.gma-rule-list.search.invalid-tokens">
            Some filters could not be applied: {{ tokens: invalidKeys.join(', ') }}
          </Trans>
        </Text>
      )}
    </Stack>
  );
}

function SearchHelp({ tokens }: { tokens: TokenDefinition[] }) {
  return (
    <Stack direction="column" gap={1}>
      <Text element="p">
        <Trans i18nKey="alerting.gma-rule-list.search.help-intro">
          Search syntax allows you to query rules by the filters below.
        </Trans>
      </Text>
      <hr />
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
        {tokens.map((token) => (
          <HelpRow key={token.key} definition={token} />
        ))}
      </Grid>
    </Stack>
  );
}

function HelpRow({ definition }: { definition: TokenDefinition }) {
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

function HelpAvailability({ definition }: { definition: TokenDefinition }) {
  const { availability, unavailableValues = [] } = definition;

  if (availability.status === 'unavailable') {
    return (
      <Stack direction="column" gap={0.25}>
        <Text element="span" color="warning">
          <Trans i18nKey="alerting.gma-rule-list.search.help-unavailable">Not available yet</Trans>
        </Text>
        <Text element="span" variant="bodySmall" color="secondary">
          {availability.reason()}
        </Text>
      </Stack>
    );
  }

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
