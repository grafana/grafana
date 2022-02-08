import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { connect, ConnectedProps } from 'react-redux';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { ServiceAccountProfile } from './ServiceAccountProfile';
import { StoreState, ServiceAccountDTO, ApiKey } from 'app/types';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import {
  deleteServiceAccountToken,
  loadServiceAccount,
  loadServiceAccountTokens,
  createServiceAccountToken,
} from './state/actions';
import { ServiceAccountTokensTable } from './ServiceAccountTokensTable';
import { getTimeZone, GrafanaTheme2, NavModel } from '@grafana/data';
import {
  Button,
  DatePickerWithInput,
  Field,
  FieldSet,
  Icon,
  Input,
  Modal,
  RadioButtonGroup,
  useStyles2,
  VerticalGroup,
} from '@grafana/ui';
import { getModalStyles } from '@grafana/ui/src/components/Modal/getModalStyles';

const expirationOptions = [
  { label: 'No expiration', value: false },
  { label: 'Set expiration date', value: true },
];

interface OwnProps extends GrafanaRouteComponentProps<{ id: string }> {
  navModel: NavModel;
  serviceAccount?: ServiceAccountDTO;
  tokens: ApiKey[];
  isLoading: boolean;
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'serviceaccounts'),
    serviceAccount: state.serviceAccountProfile.serviceAccount,
    tokens: state.serviceAccountProfile.tokens,
    isLoading: state.serviceAccountProfile.isLoading,
    timezone: getTimeZone(state.user),
  };
}
const mapDispatchToProps = {
  loadServiceAccount,
  loadServiceAccountTokens,
  createServiceAccountToken,
  deleteServiceAccountToken,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = OwnProps & ConnectedProps<typeof connector>;

const ServiceAccountPageUnconnected = ({
  navModel,
  match,
  serviceAccount,
  tokens,
  timezone,
  isLoading,
  loadServiceAccount,
  loadServiceAccountTokens,
  createServiceAccountToken,
  deleteServiceAccountToken,
}: Props) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [isWithExpirationDate, setIsWithExpirationDate] = useState(false);
  const [newTokenExpirationDate, setNewTokenExpirationDate] = useState<Date | string>('');
  const [isExpirationDateValid, setIsExpirationDateValid] = useState(false);
  const styles = useStyles2(getStyles);
  const modalStyles = useStyles2(getModalStyles);

  useEffect(() => {
    const serviceAccountId = parseInt(match.params.id, 10);
    loadServiceAccount(serviceAccountId);
    loadServiceAccountTokens(serviceAccountId);
  }, [match, loadServiceAccount, loadServiceAccountTokens]);

  const onDeleteServiceAccountToken = (key: ApiKey) => {
    deleteServiceAccountToken(parseInt(match.params.id, 10), key.id!);
  };

  const onCreateToken = () => {
    createServiceAccountToken(serviceAccount.userId);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const onExpirationDateChange = (value: Date | string) => {
    const isValid = value !== '';
    setIsExpirationDateValid(isValid);
    setNewTokenExpirationDate(value);
  };

  const modalTitle = (
    <div className={modalStyles.modalHeaderTitle}>
      <Icon name="key-skeleton-alt" size="lg" />
      <span className={styles.modalTitle}>Add service account token</span>
    </div>
  );

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={isLoading}>
        {serviceAccount && (
          <>
            <ServiceAccountProfile
              serviceaccount={serviceAccount}
              onServiceAccountDelete={() => {
                console.log(`not implemented`);
              }}
              onServiceAccountUpdate={() => {
                console.log(`not implemented`);
              }}
              onServiceAccountDisable={() => {
                console.log(`not implemented`);
              }}
              onServiceAccountEnable={() => {
                console.log(`not implemented`);
              }}
            />
          </>
        )}
        <VerticalGroup spacing="md">
          <Button onClick={() => setIsModalOpen(true)}>Add token</Button>
          <h3 className="page-heading">Tokens</h3>
          {tokens && (
            <ServiceAccountTokensTable tokens={tokens} timeZone={timezone} onDelete={onDeleteServiceAccountToken} />
          )}
        </VerticalGroup>
        <Modal isOpen={isModalOpen} title={modalTitle} onDismiss={closeModal} className={styles.modal}>
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
              options={expirationOptions}
              value={isWithExpirationDate}
              onChange={(v) => setIsWithExpirationDate(v)}
              size="md"
            />
            {isWithExpirationDate && (
              <Field label="Expiration date" className={styles.modalRow}>
                <DatePickerWithInput onChange={onExpirationDateChange} value={newTokenExpirationDate} placeholder="" />
              </Field>
            )}
          </FieldSet>
          <Button onClick={onCreateToken} disabled={isWithExpirationDate && !isExpirationDateValid}>
            Generate token
          </Button>
        </Modal>
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    modal: css`
      width: 550px;
    `,
    modalTitle: css`
      padding-left: ${theme.spacing(1)};
    `,
    modalRow: css`
      margin-bottom: ${theme.spacing(4)};
    `,
  };
};

export const ServiceAccountPage = connector(ServiceAccountPageUnconnected);
