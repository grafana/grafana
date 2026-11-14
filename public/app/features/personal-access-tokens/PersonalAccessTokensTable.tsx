import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Badge, Button, Stack, Text } from '@grafana/ui';
import { formatDate } from 'app/core/internationalization/dates';

import { type PersonalAccessToken } from './types';

interface Props {
  tokens: PersonalAccessToken[];
  onRevoke: (token: PersonalAccessToken) => void;
  canRevoke: boolean;
}

function formatOptionalDate(value?: string | null) {
  return value ? formatDate(value, { dateStyle: 'medium' }) : undefined;
}

export function summarizeScopes(token: PersonalAccessToken): string {
  const actions = Object.keys(token.scopes ?? {});
  return actions.length > 0 ? actions.join(', ') : '-';
}

export const PersonalAccessTokensTable = ({ tokens, onRevoke, canRevoke }: Props) => {
  const [now] = useState(() => Date.now());

  if (tokens.length === 0) {
    return (
      <Text color="secondary">
        <Trans i18nKey="personal-access-tokens.table.empty">No personal access tokens.</Trans>
      </Text>
    );
  }

  return (
    <table className="filter-table" aria-label={t('personal-access-tokens.table.label', 'Personal access tokens')}>
      <thead>
        <tr>
          <th>
            <Trans i18nKey="personal-access-tokens.table.name">Name</Trans>
          </th>
          <th>
            <Trans i18nKey="personal-access-tokens.table.token">Token</Trans>
          </th>
          <th>
            <Trans i18nKey="personal-access-tokens.table.scopes">Scopes</Trans>
          </th>
          <th>
            <Trans i18nKey="personal-access-tokens.table.expires">Expires</Trans>
          </th>
          <th>
            <Trans i18nKey="personal-access-tokens.table.last-used">Last used</Trans>
          </th>
          <th>
            <Trans i18nKey="personal-access-tokens.table.created">Created</Trans>
          </th>
          <th />
        </tr>
      </thead>
      <tbody>
        {tokens.map((token) => {
          const expired = Boolean(token.expiresAt) && new Date(token.expiresAt!).getTime() < now;
          const revoked = Boolean(token.revokedAt);
          return (
            <tr key={token.uid}>
              <td>{token.name}</td>
              <td>
                <code>{token.hint}</code>
              </td>
              <td>{summarizeScopes(token)}</td>
              <td>
                <Stack gap={1} alignItems="center">
                  {formatOptionalDate(token.expiresAt) ?? t('personal-access-tokens.table.never', 'Never')}
                  {expired && <Badge color="red" text={t('personal-access-tokens.table.expired', 'Expired')} />}
                </Stack>
              </td>
              <td>{formatOptionalDate(token.lastUsedAt) ?? t('personal-access-tokens.table.never-used', 'Never')}</td>
              <td>{formatOptionalDate(token.createdAt)}</td>
              <td>
                {revoked ? (
                  <Badge color="orange" text={t('personal-access-tokens.table.revoked', 'Revoked')} />
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    icon="times"
                    disabled={!canRevoke}
                    aria-label={t('personal-access-tokens.table.revoke-aria', 'Revoke token {{name}}', {
                      name: token.name,
                    })}
                    onClick={() => onRevoke(token)}
                  >
                    <Trans i18nKey="personal-access-tokens.table.revoke">Revoke</Trans>
                  </Button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
