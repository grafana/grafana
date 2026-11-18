import { Trans, t } from '@grafana/i18n';
import { Button, Drawer, Stack, Text } from '@grafana/ui';
import { formatDate } from 'app/core/internationalization/dates';

import { type AdminPersonalAccessToken } from './types';

interface Props {
  token: AdminPersonalAccessToken;
  canRevoke: boolean;
  onRevoke: (token: AdminPersonalAccessToken) => void;
  onClose: () => void;
}

const dash = '-';
const fmt = (v?: string | null) => (v ? formatDate(v, { dateStyle: 'medium', timeStyle: 'short' }) : dash);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text color="secondary" variant="bodySmall">
        {label}
      </Text>
      <div>{children}</div>
    </div>
  );
}

export function AdminPersonalAccessTokenDrawer({ token, canRevoke, onRevoke, onClose }: Props) {
  const scopes = Object.entries(token.scopes ?? {});
  return (
    <Drawer title={token.name} subtitle={token.hint} onClose={onClose}>
      <Stack direction="column" gap={2}>
        <Row label={t('personal-access-tokens.detail.owner', 'Owner')}>
          {token.ownerLogin || dash} {token.ownerEmail && `(${token.ownerEmail})`}
        </Row>
        <Row label={t('personal-access-tokens.detail.org', 'Organization')}>{token.orgName || token.orgId}</Row>
        <Row label={t('personal-access-tokens.detail.created', 'Created')}>
          {fmt(token.createdAt)} {token.createdIp && `(${token.createdIp})`}
        </Row>
        <Row label={t('personal-access-tokens.detail.expires', 'Expires')}>{fmt(token.expiresAt)}</Row>
        <Row label={t('personal-access-tokens.detail.last-used', 'Last used')}>
          {fmt(token.lastUsedAt)} {token.lastUsedIp && `(${token.lastUsedIp})`}
        </Row>
        <Row label={t('personal-access-tokens.detail.user-agent', 'Last used user agent')}>
          {token.lastUsedUserAgent || dash}
        </Row>
        <Row label={t('personal-access-tokens.detail.scopes', 'Scopes')}>
          {scopes.length === 0 ? (
            dash
          ) : (
            <ul>
              {scopes.map(([action, resources]) => (
                <li key={action}>
                  <code>{action}</code>
                  {resources.length > 0 && ` → ${resources.join(', ')}`}
                </li>
              ))}
            </ul>
          )}
        </Row>
        {token.revokedAt && (
          <Row label={t('personal-access-tokens.detail.revoked', 'Revoked')}>
            {fmt(token.revokedAt)} {token.revokedReason && `(${token.revokedReason})`}
          </Row>
        )}
        {!token.revokedAt && (
          <div>
            <Button variant="destructive" icon="times" disabled={!canRevoke} onClick={() => onRevoke(token)}>
              <Trans i18nKey="personal-access-tokens.detail.revoke">Revoke token</Trans>
            </Button>
          </div>
        )}
      </Stack>
    </Drawer>
  );
}
