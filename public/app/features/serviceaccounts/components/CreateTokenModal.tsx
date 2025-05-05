import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  Button,
  ClipboardButton,
  DatePickerWithInput,
  Field,
  Input,
  Modal,
  RadioButtonGroup,
  useStyles2,
} from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

const EXPIRATION_OPTIONS = [
  { label: 'No expiration', value: false },
  { label: 'Set expiration date', value: true },
];

export type ServiceAccountToken = {
  name: string;
  secondsToLive?: number;
};

interface Props {
  isOpen: boolean;
  token: string;
  serviceAccountLogin: string;
  onCreateToken: (token: ServiceAccountToken) => void;
  onClose: () => void;
}

export const CreateTokenModal = ({ isOpen, token, serviceAccountLogin, onCreateToken, onClose }: Props) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const maxExpirationDate = new Date();
  if (config.tokenExpirationDayLimit !== undefined && config.tokenExpirationDayLimit > -1) {
    maxExpirationDate.setDate(maxExpirationDate.getDate() + config.tokenExpirationDayLimit + 1);
  } else {
    maxExpirationDate.setDate(8640000000000000);
  }
  const defaultExpirationDate = config.tokenExpirationDayLimit !== undefined && config.tokenExpirationDayLimit > 0;

  const [defaultTokenName, setDefaultTokenName] = useState('');
  const [newTokenName, setNewTokenName] = useState('');
  const [isWithExpirationDate, setIsWithExpirationDate] = useState(defaultExpirationDate);
  const [newTokenExpirationDate, setNewTokenExpirationDate] = useState<Date | string>(tomorrow);
  const [isExpirationDateValid, setIsExpirationDateValid] = useState(newTokenExpirationDate !== '');
  const styles = useStyles2(getStyles);

  useEffect(() => {
    // Generate new token name every time we open modal
    if (isOpen) {
      setDefaultTokenName(`${serviceAccountLogin}-${uuidv4()}`);
    }
  }, [serviceAccountLogin, isOpen]);

  const onExpirationDateChange = (value: Date | string) => {
    const isValid = value !== '';
    setIsExpirationDateValid(isValid);
    setNewTokenExpirationDate(value);
  };

  const onGenerateToken = () => {
    onCreateToken({
      name: newTokenName || defaultTokenName,
      secondsToLive: isWithExpirationDate ? getSecondsToLive(newTokenExpirationDate) : undefined,
    });
  };

  const onCloseInternal = () => {
    setNewTokenName('');
    setDefaultTokenName('');
    setIsWithExpirationDate(defaultExpirationDate);
    setNewTokenExpirationDate(tomorrow);
    setIsExpirationDateValid(newTokenExpirationDate !== '');
    onClose();
  };

  const modalTitle = !token ? 'Add service account token' : 'Service account token created';

  return (
    <Modal isOpen={isOpen} title={modalTitle} onDismiss={onCloseInternal} className={styles.modal}>
      {!token ? (
        <div>
          <Field
            label={t('serviceaccounts.create-token-modal.label-display-name', 'Display name')}
            description={t(
              'serviceaccounts.create-token-modal.description-name-to-easily-identify-the-token',
              'Name to easily identify the token'
            )}
            // for now this is required
            // need to make this optional in backend as well
            required={true}
          >
            <Input
              name="tokenName"
              value={newTokenName}
              placeholder={defaultTokenName}
              onChange={(e) => {
                setNewTokenName(e.currentTarget.value);
              }}
            />
          </Field>
          <Field label={t('serviceaccounts.create-token-modal.label-expiration', 'Expiration')}>
            <RadioButtonGroup
              options={EXPIRATION_OPTIONS}
              value={isWithExpirationDate}
              onChange={setIsWithExpirationDate}
              size="md"
            />
          </Field>
          {isWithExpirationDate && (
            <Field label={t('serviceaccounts.create-token-modal.label-expiration-date', 'Expiration date')}>
              <DatePickerWithInput
                onChange={onExpirationDateChange}
                value={newTokenExpirationDate}
                placeholder=""
                minDate={tomorrow}
                maxDate={maxExpirationDate}
              />
            </Field>
          )}
          <Modal.ButtonRow>
            <Button onClick={onGenerateToken} disabled={isWithExpirationDate && !isExpirationDateValid}>
              <Trans i18nKey="serviceaccounts.create-token-modal.generate-token">Generate token</Trans>
            </Button>
          </Modal.ButtonRow>
        </div>
      ) : (
        <>
          <Field
            label={t('serviceaccounts.create-token-modal.label-token', 'Token')}
            description={t(
              'serviceaccounts.create-token-modal.description-token',
              'Copy the token now as you will not be able to see it again. Losing a token requires creating a new one.'
            )}
          >
            <div className={styles.modalTokenRow}>
              <Input name="tokenValue" value={token} readOnly />
              <ClipboardButton
                className={styles.modalCopyToClipboardButton}
                variant="primary"
                size="md"
                icon="copy"
                getText={() => token}
              >
                <Trans i18nKey="serviceaccounts.create-token-modal.copy-clipboard">Copy to clipboard</Trans>
              </ClipboardButton>
            </div>
          </Field>
          <Modal.ButtonRow>
            <ClipboardButton variant="primary" getText={() => token} onClipboardCopy={onCloseInternal}>
              <Trans i18nKey="serviceaccounts.create-token-modal.copy-to-clipboard-and-close">
                Copy to clipboard and close
              </Trans>
            </ClipboardButton>
            <Button variant="secondary" onClick={onCloseInternal}>
              <Trans i18nKey="serviceaccounts.create-token-modal.close">Close</Trans>
            </Button>
          </Modal.ButtonRow>
        </>
      )}
    </Modal>
  );
};

const getSecondsToLive = (date: Date | string) => {
  const dateAsDate = new Date(date);
  const now = new Date();

  return Math.ceil((dateAsDate.getTime() - now.getTime()) / 1000);
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    modal: css({
      width: '550px',
    }),
    modalTokenRow: css({
      display: 'flex',
    }),
    modalCopyToClipboardButton: css({
      marginLeft: theme.spacing(0.5),
    }),
  };
};
