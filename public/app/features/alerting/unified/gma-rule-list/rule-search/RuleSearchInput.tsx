import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { FilterInput, Grid, Icon, Label, Stack, Text } from '@grafana/ui';

import { PopupCard } from '../../components/HoverCard';

import { getIssueHints } from './filterIssueHints';
import { type FilterIssue } from './filterIssues';
import { parse } from './parser';
import { serialize } from './serializer';
import { type TokenDefinition } from './tokens';

export interface RuleSearchInputProps {
  query: string;
  onApply: (query: string) => void;
  tokens: TokenDefinition[];
  issues?: FilterIssue[];
  debounceMs?: number;
  /** Shown on the label line, after the help icon. */
  labelSuffix?: ReactNode;
}

const DEFAULT_DEBOUNCE_MS = 400;
const INPUT_ID = 'rule-search-input';
const ISSUES_DESCRIPTION_ID = 'rule-search-input-issues';

/** The typed text is a draft, replaced only when the query changes elsewhere (sidebar, saved search, clear). */
export function RuleSearchInput({
  query,
  onApply,
  tokens,
  issues = [],
  debounceMs = DEFAULT_DEBOUNCE_MS,
  labelSuffix,
}: RuleSearchInputProps) {
  const [draft, setDraft] = useState(query);
  // A `query` equal to the canonical form of this text is an echo of our own apply.
  const lastAppliedRef = useRef(query);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const canonicalize = useCallback((text: string) => serialize(parse(text, tokens)), [tokens]);

  useEffect(() => {
    if (query === canonicalize(lastAppliedRef.current)) {
      return;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    lastAppliedRef.current = query;
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
    setDraft(value);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Half-typed filters would flash invalid, so only complete text applies while typing.
    if (parse(value, tokens).invalid.length === 0) {
      timeoutRef.current = setTimeout(() => apply(value), debounceMs);
    }
  };

  const invalidKeys = [...new Set(issues.map((issue) => issue.key))];
  const hasIssues = invalidKeys.length > 0;
  const hints = getIssueHints(issues, tokens);

  return (
    <Stack direction="column" gap={0.5} width="100%">
      <Stack gap={0.5} alignItems="center">
        <Label htmlFor={INPUT_ID}>
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
        {labelSuffix}
      </Stack>
      <FilterInput
        id={INPUT_ID}
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
        <Stack id={ISSUES_DESCRIPTION_ID} direction="column" gap={0}>
          <Text color="error" variant="bodySmall" element="p">
            <Trans i18nKey="alerting.gma-rule-list.search.invalid-tokens">
              Some filters could not be applied: {{ tokens: invalidKeys.join(', ') }}
            </Trans>
          </Text>
          {hints.map((hint) => (
            <Text key={hint} color="error" variant="bodySmall" element="p">
              {hint}
            </Text>
          ))}
        </Stack>
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
