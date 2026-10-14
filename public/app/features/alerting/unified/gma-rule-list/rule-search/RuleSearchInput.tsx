import { useCallback, useEffect, useRef, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { FilterInput, Grid, Icon, Label, Stack, Text } from '@grafana/ui';

import { PopupCard } from '../../components/HoverCard';

import { type CriteriaIssue } from './criteriaIssues';
import { type TokenDefinition } from './tokens';

export interface RuleSearchInputProps {
  /** The applied canonical query — the full serialized criteria, not just free text. */
  query: string;
  /** Called on a debounced valid edit, and immediately on Enter or blur. */
  onApply: (query: string) => void;
  /** This page's token registry, used to generate the help popover. */
  tokens: TokenDefinition[];
  /** Invalid/unresolved tokens to describe accessibly — from getCriteriaIssues(). */
  issues?: CriteriaIssue[];
  debounceMs?: number;
  id?: string;
}

const DEFAULT_DEBOUNCE_MS = 400;
const ISSUES_DESCRIPTION_ID = 'rule-search-input-issues';

/**
 * Free-text + filter-syntax search input shared by the Alert and Recording pages. Keeps a
 * local typing draft separate from the applied query so incomplete input never corrupts URL
 * state, matching the debounce-while-typing / apply-immediately-on-Enter contract.
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
  // Tracks the last value *this component* applied, so the effect below only resyncs the
  // draft when `query` changed for some other reason (URL nav, sidebar edit, Clear
  // filters) — not as an echo of our own apply causing a re-render.
  const lastAppliedRef = useRef(query);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (query !== lastAppliedRef.current) {
      lastAppliedRef.current = query;
      setDraft(query);
    }
  }, [query]);

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
    timeoutRef.current = setTimeout(() => apply(value), debounceMs);
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
        onBlur={() => apply(draft)}
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
          Search syntax allows you to query rules by the filters below. Filters marked &quot;coming soon&quot; are
          visible but not yet functional.
        </Trans>
      </Text>
      <hr />
      <Grid columns={2} gap={1} alignItems="center">
        <Text weight="bold">
          <Trans i18nKey="alerting.gma-rule-list.search.help-filter-type">Filter type</Trans>
        </Text>
        <Text weight="bold">
          <Trans i18nKey="alerting.gma-rule-list.search.help-expression">Expression</Trans>
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
      <Text element="span">
        {definition.description}
        {definition.availability === 'pending' && (
          <>
            {' '}
            <Text color="secondary" variant="bodySmall">
              (<Trans i18nKey="alerting.gma-rule-list.search.help-coming-soon">coming soon</Trans>)
            </Text>
          </>
        )}
      </Text>
      <code>{definition.example}</code>
    </>
  );
}
