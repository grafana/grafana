import { useState } from 'react';
import { useAsyncRetry } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Checkbox, ConfirmModal, Field, Stack, Switch, Text } from '@grafana/ui';

import { type PolicyLevel, personalAccessTokensApi } from './api';
import { type PersonalAccessTokenPolicy } from './types';
import { errorMessage } from './utils';

interface Props {
  level: PolicyLevel;
  canWrite: boolean;
}

export const PersonalAccessTokenPolicySwitch = ({ level, canWrite }: Props) => {
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [revokeExisting, setRevokeExisting] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const {
    value: policy,
    error: loadError,
    retry,
    loading,
  } = useAsyncRetry(() => personalAccessTokensApi.getPolicy(level), [level]);
  const [override, setOverride] = useState<PersonalAccessTokenPolicy>();
  const current = override ?? policy;

  const update = async (enabled: boolean, revoke: boolean) => {
    try {
      const res = await personalAccessTokensApi.updatePolicy(level, { enabled, revokeExisting: revoke });
      setOverride({ enabled: res.enabled, managedByConfig: res.managedByConfig });
      setError(undefined);
      setNotice(
        res.revoked > 0
          ? t('personal-access-tokens.policy.revoked', '', {
              count: res.revoked,
              defaultValue_one: '{{count}} token revoked',
              defaultValue_other: '{{count}} tokens revoked',
            })
          : undefined
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setConfirmDisable(false);
      setRevokeExisting(false);
    }
  };

  const readOnly = !canWrite || Boolean(current?.managedByConfig);
  const title =
    level === 'instance'
      ? t('personal-access-tokens.policy.instance', 'Allow personal access tokens on this instance')
      : t('personal-access-tokens.policy.org', 'Allow personal access tokens in this organization');

  const shownError = error ?? (loadError ? errorMessage(loadError) : undefined);

  if (loading && !current) {
    return null;
  }

  return (
    <Stack direction="column" gap={1}>
      {shownError && (
        <Alert severity="error" title={t('personal-access-tokens.policy.error', 'Request failed')}>
          {shownError}
        </Alert>
      )}
      {notice && <Alert severity="info" title={notice} />}
      {current && (
        <>
          <Field label={title} disabled={readOnly} noMargin>
            <Switch
              value={current.enabled}
              disabled={readOnly}
              label={title}
              onChange={(e) => {
                if (e.currentTarget.checked) {
                  update(true, false);
                } else {
                  setConfirmDisable(true);
                }
              }}
            />
          </Field>
          {current.managedByConfig && (
            <Text color="secondary">
              <Trans i18nKey="personal-access-tokens.policy.managed">
                This setting is managed by the Grafana configuration and cannot be changed here.
              </Trans>
            </Text>
          )}
          <ConfirmModal
            isOpen={confirmDisable}
            title={t('personal-access-tokens.policy.disable-title', 'Disable personal access tokens')}
            body={
              <Stack direction="column" gap={1}>
                <Trans i18nKey="personal-access-tokens.policy.disable-body">
                  Existing tokens stop working while the switch is off. They work again when it is re-enabled, unless
                  you revoke them.
                </Trans>
                <Checkbox
                  label={t('personal-access-tokens.policy.revoke-existing', 'Also permanently revoke existing tokens')}
                  value={revokeExisting}
                  onChange={(e) => setRevokeExisting(e.currentTarget.checked)}
                />
              </Stack>
            }
            confirmText={t('personal-access-tokens.policy.disable-confirm', 'Disable')}
            onConfirm={() => update(false, revokeExisting)}
            onDismiss={() => {
              setConfirmDisable(false);
              setRevokeExisting(false);
            }}
          />
        </>
      )}
      {!current && (
        <Button variant="secondary" onClick={retry}>
          <Trans i18nKey="personal-access-tokens.policy.retry">Retry</Trans>
        </Button>
      )}
    </Stack>
  );
};
