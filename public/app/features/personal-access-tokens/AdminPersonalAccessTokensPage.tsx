import { useState } from 'react';
import { useAsyncRetry } from 'react-use';

import { type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ConfirmModal,
  Field,
  FilterInput,
  Pagination,
  Select,
  Stack,
  Text,
  TextLink,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { formatDate } from 'app/core/internationalization/dates';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { AdminPersonalAccessTokenDrawer } from './AdminPersonalAccessTokenDrawer';
import { PersonalAccessTokenPolicySwitch } from './PersonalAccessTokenPolicySwitch';
import { summarizeScopes } from './PersonalAccessTokensTable';
import { personalAccessTokensApi } from './api';
import {
  type AdminPersonalAccessToken,
  type PersonalAccessTokenStatus,
  type SearchPersonalAccessTokensParams,
} from './types';
import { errorMessage } from './utils';

const PER_PAGE = 25;

type SortField = NonNullable<SearchPersonalAccessTokensParams['sort']>;
const DAY_MS = 24 * 60 * 60 * 1000;

type StatusFilter = PersonalAccessTokenStatus | 'any';

function statusOf(token: AdminPersonalAccessToken, now: number): PersonalAccessTokenStatus {
  if (token.revokedAt) {
    return 'revoked';
  }
  return token.expiresAt && new Date(token.expiresAt).getTime() <= now ? 'expired' : 'active';
}

function StatusBadge({ status }: { status: PersonalAccessTokenStatus }) {
  switch (status) {
    case 'revoked':
      return <Badge color="orange" text={t('personal-access-tokens.status.revoked', 'Revoked')} />;
    case 'expired':
      return <Badge color="red" text={t('personal-access-tokens.status.expired', 'Expired')} />;
    default:
      return <Badge color="green" text={t('personal-access-tokens.status.active', 'Active')} />;
  }
}

const date = (v?: string | null, fallback = '-') => (v ? formatDate(v, { dateStyle: 'medium' }) : fallback);

export function AdminPersonalAccessTokensPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('any');
  const [expiringDays, setExpiringDays] = useState<number>(0);
  const [allOrgs, setAllOrgs] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: SortField; desc: boolean }>();
  const [selected, setSelected] = useState<AdminPersonalAccessToken>();
  const [toRevoke, setToRevoke] = useState<AdminPersonalAccessToken>();
  const [actionError, setActionError] = useState<string>();
  const [now] = useState(() => Date.now());

  const canWriteOrg = contextSrv.hasPermission(AccessControlAction.OrgsWrite);
  const canRevoke = contextSrv.hasPermission(AccessControlAction.UsersTokensDelete);

  const {
    value: result,
    loading,
    error: listError,
    retry,
  } = useAsyncRetry(
    () =>
      personalAccessTokensApi.search({
        query,
        status: status === 'any' ? undefined : status,
        expiringBefore: expiringDays > 0 ? new Date(Date.now() + expiringDays * DAY_MS).toISOString() : undefined,
        allOrgs,
        sort: sort?.field,
        order: sort ? (sort.desc ? 'desc' : 'asc') : undefined,
        page,
        perPage: PER_PAGE,
      }),
    [query, status, expiringDays, allOrgs, page, sort]
  );
  const tokens = result?.tokens ?? [];
  const totalPages = Math.max(1, Math.ceil((result?.totalCount ?? 0) / PER_PAGE));
  const error = actionError ?? (listError ? errorMessage(listError) : undefined);

  const statusOptions: Array<SelectableValue<StatusFilter>> = [
    { value: 'any', label: t('personal-access-tokens.filter.any-status', 'Any status') },
    { value: 'active', label: t('personal-access-tokens.status.active', 'Active') },
    { value: 'expired', label: t('personal-access-tokens.status.expired', 'Expired') },
    { value: 'revoked', label: t('personal-access-tokens.status.revoked', 'Revoked') },
  ];
  const expiringOptions: Array<SelectableValue<number>> = [
    { value: 0, label: t('personal-access-tokens.filter.any-expiry', 'Any expiry') },
    { value: 7, label: t('personal-access-tokens.filter.expiring-7', 'Expiring within 7 days') },
    { value: 30, label: t('personal-access-tokens.filter.expiring-30', 'Expiring within 30 days') },
  ];

  const toggleSort = (field: SortField) => {
    setSort((cur) => (cur?.field === field ? { field, desc: !cur.desc } : { field, desc: false }));
    setPage(1);
  };
  const sortableHeader = (field: SortField, label: string) => {
    const active = sort?.field === field;
    return (
      <th aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
        <Button
          variant="secondary"
          fill="text"
          size="sm"
          icon={active ? (sort.desc ? 'arrow-down' : 'arrow-up') : undefined}
          onClick={() => toggleSort(field)}
        >
          {label}
        </Button>
      </th>
    );
  };

  const onConfirmRevoke = async () => {
    if (!toRevoke) {
      return;
    }
    try {
      setActionError(undefined);
      await personalAccessTokensApi.revokeByUid(toRevoke.uid, allOrgs);
      setSelected(undefined);
      retry();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setToRevoke(undefined);
    }
  };

  return (
    <Page navId="personal-access-tokens-admin">
      <Page.Contents>
        <Stack direction="column" gap={4}>
          <section>
            <h3>
              <Trans i18nKey="personal-access-tokens.admin.policy-heading">Availability</Trans>
            </h3>
            <PersonalAccessTokenPolicySwitch level="instance" canWrite={contextSrv.isGrafanaAdmin} />
            <PersonalAccessTokenPolicySwitch level="org" canWrite={canWriteOrg} />
          </section>
          <section>
            <h3>
              <Trans i18nKey="personal-access-tokens.admin.tokens-heading">User tokens</Trans>
            </h3>
            <Stack gap={2} wrap="wrap" alignItems="flex-end">
              <Field noMargin label={t('personal-access-tokens.filter.search', 'Search')}>
                <FilterInput
                  value={query}
                  onChange={(v) => {
                    setQuery(v);
                    setPage(1);
                  }}
                  placeholder={t(
                    'personal-access-tokens.filter.search-placeholder',
                    'Token name, owner login or email'
                  )}
                  width={40}
                />
              </Field>
              <Field noMargin label={t('personal-access-tokens.filter.status', 'Status')}>
                <Select
                  width={20}
                  options={statusOptions}
                  value={status}
                  onChange={(v) => {
                    setStatus(v.value ?? 'any');
                    setPage(1);
                  }}
                />
              </Field>
              <Field noMargin label={t('personal-access-tokens.filter.expiry', 'Expiry')}>
                <Select
                  width={28}
                  options={expiringOptions}
                  value={expiringDays}
                  onChange={(v) => {
                    setExpiringDays(v.value ?? 0);
                    setPage(1);
                  }}
                />
              </Field>
              {contextSrv.isGrafanaAdmin && (
                <Checkbox
                  label={t('personal-access-tokens.filter.all-orgs', 'All organizations')}
                  value={allOrgs}
                  onChange={(e) => {
                    setAllOrgs(e.currentTarget.checked);
                    setPage(1);
                  }}
                />
              )}
            </Stack>
            {error && (
              <Alert severity="error" title={t('personal-access-tokens.admin.error', 'Request failed')}>
                {error}
              </Alert>
            )}
            {!loading && tokens.length === 0 ? (
              <Text color="secondary">
                <Trans i18nKey="personal-access-tokens.table.empty">No personal access tokens.</Trans>
              </Text>
            ) : (
              <table
                className="filter-table"
                aria-label={t('personal-access-tokens.table.label', 'Personal access tokens')}
              >
                <thead>
                  <tr>
                    {sortableHeader('name', t('personal-access-tokens.table.name', 'Name'))}
                    {sortableHeader('owner', t('personal-access-tokens.table.owner', 'Owner'))}
                    {sortableHeader('org', t('personal-access-tokens.table.org', 'Organization'))}
                    {sortableHeader('scopes', t('personal-access-tokens.table.scopes', 'Scopes'))}
                    {sortableHeader('expires', t('personal-access-tokens.table.expires', 'Expires'))}
                    {sortableHeader('lastUsed', t('personal-access-tokens.table.last-used', 'Last used'))}
                    {sortableHeader('status', t('personal-access-tokens.table.status', 'Status'))}
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((tok) => (
                    <tr key={tok.uid}>
                      <td>
                        <TextLink
                          href={`#${tok.uid}`}
                          color="primary"
                          inline={false}
                          onClick={(e) => {
                            e.preventDefault();
                            setSelected(tok);
                          }}
                          aria-label={t('personal-access-tokens.table.open', 'View token {{name}}', { name: tok.name })}
                        >
                          {tok.name}
                        </TextLink>
                      </td>
                      <td>{tok.ownerLogin || tok.userId}</td>
                      <td>{tok.orgName || tok.orgId}</td>
                      <td>{summarizeScopes(tok)}</td>
                      <td>{date(tok.expiresAt, t('personal-access-tokens.table.never', 'Never'))}</td>
                      <td>{date(tok.lastUsedAt, t('personal-access-tokens.table.never-used', 'Never'))}</td>
                      <td>
                        <StatusBadge status={statusOf(tok, now)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {totalPages > 1 && <Pagination currentPage={page} numberOfPages={totalPages} onNavigate={setPage} />}
          </section>
        </Stack>
        {selected && (
          <AdminPersonalAccessTokenDrawer
            token={selected}
            canRevoke={canRevoke}
            onRevoke={setToRevoke}
            onClose={() => setSelected(undefined)}
          />
        )}
        <ConfirmModal
          isOpen={Boolean(toRevoke)}
          title={t('personal-access-tokens.revoke-title', 'Revoke token')}
          body={t(
            'personal-access-tokens.revoke-body',
            'Revoking token {{name}} is permanent and immediately stops it from working.',
            { name: toRevoke?.name ?? '' }
          )}
          confirmText={t('personal-access-tokens.revoke-confirm', 'Revoke')}
          onConfirm={onConfirmRevoke}
          onDismiss={() => setToRevoke(undefined)}
        />
      </Page.Contents>
    </Page>
  );
}

export default AdminPersonalAccessTokensPage;
