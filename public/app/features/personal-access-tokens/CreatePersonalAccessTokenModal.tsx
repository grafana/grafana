import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Button,
  ClipboardButton,
  Field,
  Input,
  Modal,
  Stack,
  RadioButtonGroup,
  TextArea,
  useStyles2,
} from '@grafana/ui';

import { type CreatePersonalAccessTokenRequest, type PersonalAccessTokenScopes } from './types';

type ScopePreset = 'read-only' | 'full' | 'custom';

export const DEFAULT_LIFETIME_DAYS = 30;

export function buildScopes(preset: ScopePreset, custom: string): PersonalAccessTokenScopes {
  if (preset === 'read-only') {
    return { '*:read': [] };
  }
  if (preset === 'full') {
    return { '*': [] };
  }
  const scopes: PersonalAccessTokenScopes = {};
  for (const action of custom.split(/[\s,]+/)) {
    if (action) {
      scopes[action] = [];
    }
  }
  return scopes;
}

interface Props {
  isOpen: boolean;
  // The secret is shown exactly once, right after creation.
  token: string;
  error?: string;
  onCreate: (req: CreatePersonalAccessTokenRequest) => void;
  onClose: () => void;
}

export const CreatePersonalAccessTokenModal = ({ isOpen, token, error, onCreate, onClose }: Props) => {
  const styles = useStyles2(getStyles);
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<ScopePreset>('read-only');
  const [custom, setCustom] = useState('');
  const [days, setDays] = useState(String(DEFAULT_LIFETIME_DAYS));

  const lifetimeDays = Number(days);
  const scopes = buildScopes(preset, custom);
  const daysValid = Number.isInteger(lifetimeDays) && lifetimeDays > 0;
  const valid = name.trim() !== '' && daysValid && Object.keys(scopes).length > 0;

  const close = () => {
    setName('');
    setPreset('read-only');
    setCustom('');
    setDays(String(DEFAULT_LIFETIME_DAYS));
    onClose();
  };

  const presetOptions = [
    { label: t('personal-access-tokens.create.preset-read-only', 'Read only'), value: 'read-only' as const },
    { label: t('personal-access-tokens.create.preset-full', 'Same as my permissions'), value: 'full' as const },
    { label: t('personal-access-tokens.create.preset-custom', 'Custom'), value: 'custom' as const },
  ];

  return (
    <Modal
      isOpen={isOpen}
      title={
        token
          ? t('personal-access-tokens.create.title-created', 'Personal access token created')
          : t('personal-access-tokens.create.title', 'Add personal access token')
      }
      onDismiss={close}
      className={styles.modal}
    >
      {token ? (
        <Stack direction="column" gap={2}>
          <Field
            noMargin
            label={t('personal-access-tokens.create.token', 'Token')}
            description={t(
              'personal-access-tokens.create.token-description',
              'Copy the token now as you will not be able to see it again. Losing a token requires creating a new one.'
            )}
          >
            <div className={styles.row}>
              <Input
                name="tokenValue"
                value={token}
                readOnly
                aria-label={t('personal-access-tokens.create.token', 'Token')}
              />
              <ClipboardButton variant="primary" icon="copy" getText={() => token}>
                <Trans i18nKey="personal-access-tokens.create.copy">Copy to clipboard</Trans>
              </ClipboardButton>
            </div>
          </Field>
          <Modal.ButtonRow>
            <Button variant="secondary" onClick={close}>
              <Trans i18nKey="personal-access-tokens.create.close">Close</Trans>
            </Button>
          </Modal.ButtonRow>
        </Stack>
      ) : (
        <Stack direction="column" gap={2}>
          {error && (
            <Alert severity="error" title={t('personal-access-tokens.create.error', 'Could not create token')}>
              {error}
            </Alert>
          )}
          <Field noMargin label={t('personal-access-tokens.create.name', 'Display name')} required>
            <Input name="tokenName" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          </Field>
          <Field
            noMargin
            label={t('personal-access-tokens.create.scopes', 'Permissions')}
            description={t(
              'personal-access-tokens.create.scopes-description',
              'A token can never do more than your own permissions allow, and some sensitive actions are always blocked.'
            )}
          >
            <RadioButtonGroup options={presetOptions} value={preset} onChange={setPreset} />
          </Field>
          {preset === 'custom' && (
            <Field
              noMargin
              label={t('personal-access-tokens.create.custom-actions', 'Allowed actions')}
              description={t(
                'personal-access-tokens.create.custom-actions-description',
                'Comma or space separated RBAC actions, for example dashboards:read or folders:*'
              )}
            >
              <TextArea value={custom} onChange={(e) => setCustom(e.currentTarget.value)} rows={3} />
            </Field>
          )}
          <Field
            noMargin
            label={t('personal-access-tokens.create.lifetime', 'Expires in (days)')}
            description={t(
              'personal-access-tokens.create.lifetime-description',
              'The server enforces a maximum lifetime.'
            )}
            invalid={!daysValid}
            error={t('personal-access-tokens.create.lifetime-error', 'Enter a whole number of days greater than 0')}
          >
            <Input type="number" min={1} value={days} onChange={(e) => setDays(e.currentTarget.value)} />
          </Field>
          <Modal.ButtonRow>
            <Button variant="secondary" fill="outline" onClick={close}>
              <Trans i18nKey="personal-access-tokens.create.cancel">Cancel</Trans>
            </Button>
            <Button disabled={!valid} onClick={() => onCreate({ name: name.trim(), scopes, lifetimeDays })}>
              <Trans i18nKey="personal-access-tokens.create.generate">Generate token</Trans>
            </Button>
          </Modal.ButtonRow>
        </Stack>
      )}
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({ width: '550px' }),
  row: css({ display: 'flex', gap: theme.spacing(1) }),
});
