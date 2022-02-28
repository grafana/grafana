import React, { useState } from 'react';
import { css } from '@emotion/css';
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
import { ApiKey, OrgRole } from 'app/types';

const EXPIRATION_OPTIONS = [
  { label: 'No expiration', value: false },
  { label: 'Set expiration date', value: true },
];

interface CreateTokenModalProps {
  isOpen: boolean;
  token: string;
  onCreateToken: (token: ApiKey) => void;
  onClose: () => void;
}

export const CreateTokenModal = ({ isOpen, token, onCreateToken, onClose }: CreateTokenModalProps) => {
  const [newTokenName, setNewTokenName] = useState('');
  const [isWithExpirationDate, setIsWithExpirationDate] = useState(false);
  const [newTokenExpirationDate, setNewTokenExpirationDate] = useState<Date | string>('');
  const [isExpirationDateValid, setIsExpirationDateValid] = useState(false);
  const styles = useStyles2(getStyles);

  const onExpirationDateChange = (value: Date | string) => {
    const isValid = value !== '';
    setIsExpirationDateValid(isValid);
    setNewTokenExpirationDate(value);
  };

  const onCloseInternal = () => {
    setNewTokenName('');
    setIsWithExpirationDate(false);
    setNewTokenExpirationDate('');
    setIsExpirationDateValid(false);
    onClose();
  };

  const modalTitle = (
    <div className={styles.modalHeaderTitle}>
      <Icon className={styles.modalHeaderIcon} name="key-skeleton-alt" size="lg" />
      <span>{!token ? 'Add service account token' : 'Service account token created'}</span>
    </div>
  );

  return (
    <Modal isOpen={isOpen} title={modalTitle} onDismiss={onCloseInternal} className={styles.modal}>
      {!token ? (
        <>
          <FieldSet>
            <Field
              label="Display name"
              description="Optional name to easily identify the token"
              className={styles.modalRow}
            >
              <Input
                name="tokenName"
                value={newTokenName}
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
                <DatePickerWithInput onChange={onExpirationDateChange} value={newTokenExpirationDate} placeholder="" />
              </Field>
            )}
          </FieldSet>
          <Button
            onClick={() =>
              onCreateToken({
                name: newTokenName,
                role: OrgRole.Viewer,
                secondsToLive: getSecondsToLive(newTokenExpirationDate),
              })
            }
            disabled={isWithExpirationDate && !isExpirationDateValid}
          >
            Generate token
          </Button>
        </>
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
    modalRow: css`
      margin-bottom: ${theme.spacing(4)};
    `,
    modalTokenRow: css`
      display: flex;
    `,
    modalCopyToClipboardButton: css`
      margin-left: ${theme.spacing(0.5)};
    `,
    modalHeaderTitle: css`
      font-size: ${theme.typography.size.lg};
      margin: ${theme.spacing(0, 4, 0, 1)};
      display: flex;
      align-items: center;
      position: relative;
      top: 2px;
    `,
    modalHeaderIcon: css`
      margin-right: ${theme.spacing(2)};
      font-size: inherit;
      &:before {
        vertical-align: baseline;
      }
    `,
  };
};
