import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  ClipboardButton,
  DatePickerWithInput,
  Field,
  FieldSet,
  HorizontalGroup,
  Icon,
  Input,
  Label,
  Modal,
  RadioButtonGroup,
  useStyles2,
} from '@grafana/ui';

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
  let tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [defaultTokenName, setDefaultTokenName] = useState('');
  const [newTokenName, setNewTokenName] = useState('');
  const [isWithExpirationDate, setIsWithExpirationDate] = useState(false);
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
    setIsWithExpirationDate(false);
    setNewTokenExpirationDate(tomorrow);
    setIsExpirationDateValid(newTokenExpirationDate !== '');
    onClose();
  };

  const modalTitle = !token ? 'Add service account token' : 'Service account token created';

  return (
    <Modal
      isOpen={isOpen}
      title={modalTitle}
      onDismiss={onCloseInternal}
      className={styles.modal}
      contentClassName={styles.modalContent}
    >
      {!token ? (
        <div>
          <FieldSet>
            <Field
              label="Display name"
              description="Name to easily identify the token"
              className={styles.modalRow}
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
            <RadioButtonGroup
              className={styles.modalRow}
              options={EXPIRATION_OPTIONS}
              value={isWithExpirationDate}
              onChange={setIsWithExpirationDate}
              size="md"
            />
            {isWithExpirationDate && (
              <Field label="Expiration date" className={styles.modalRow}>
                <DatePickerWithInput
                  onChange={onExpirationDateChange}
                  value={newTokenExpirationDate}
                  placeholder=""
                  minDate={tomorrow}
                />
              </Field>
            )}
          </FieldSet>
          <Modal.ButtonRow>
            <Button onClick={onGenerateToken} disabled={isWithExpirationDate && !isExpirationDateValid}>
              Generate token
            </Button>
          </Modal.ButtonRow>
        </div>
      ) : (
        <>
          <FieldSet>
            <Label
              description="You will not be able to see or generate it again. Loosing a token requires creating new one."
              className={styles.modalRow}
            >
              Copy the token. It will be showed only once.
            </Label>
            <Field label="Token" className={styles.modalRow}>
              <div className={styles.modalTokenRow}>
                <Input name="tokenValue" value={token} readOnly />
                <ClipboardButton
                  className={styles.modalCopyToClipboardButton}
                  variant="secondary"
                  size="md"
                  getText={() => token}
                >
                  <Icon name="copy" /> Copy to clipboard
                </ClipboardButton>
              </div>
            </Field>
          </FieldSet>
          <HorizontalGroup>
            <ClipboardButton variant="primary" getText={() => token} onClipboardCopy={onCloseInternal}>
              Copy to clipboard and close
            </ClipboardButton>
            <Button variant="secondary" onClick={onCloseInternal}>
              Close
            </Button>
          </HorizontalGroup>
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
    modal: css`
      width: 550px;
    `,
    modalContent: css`
      overflow: visible;
    `,
    modalRow: css`
      margin-bottom: ${theme.spacing(4)};
    `,
    modalTokenRow: css`
      display: flex;
    `,
    modalCopyToClipboardButton: css`
      margin-left: ${theme.spacing(0.5)};
    `,
  };
};
