import { css } from '@emotion/css';
import React, { useRef, useState } from 'react';
import { useDispatch } from 'react-redux';

import { dateTimeFormat, GrafanaTheme2, OrgRole, TimeZone } from '@grafana/data';
import { Button, ConfirmModal, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Role, ServiceAccountDTO } from 'app/types';

import { ServiceAccountProfileRow } from './ServiceAccountProfileRow';
import { ServiceAccountRoleRow } from './ServiceAccountRoleRow';
import { deleteServiceAccount, updateServiceAccount } from './state/actionsServiceAccountPage';

interface Props {
  serviceAccount: ServiceAccountDTO;
  timeZone: TimeZone;

  roleOptions: Role[];
  builtInRoles: Record<string, Role[]>;
}

export function ServiceAccountProfile({ serviceAccount, timeZone, roleOptions, builtInRoles }: Props): JSX.Element {
  const dispatch = useDispatch();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);

  const ableToWrite = contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite);

  const deleteServiceAccountRef = useRef<HTMLButtonElement | null>(null);
  const showDeleteServiceAccountModal = (show: boolean) => () => {
    setShowDeleteModal(show);
    if (!show && deleteServiceAccountRef.current) {
      deleteServiceAccountRef.current.focus();
    }
  };

  const disableServiceAccountRef = useRef<HTMLButtonElement | null>(null);
  const showDisableServiceAccountModal = (show: boolean) => () => {
    setShowDisableModal(show);
    if (!show && disableServiceAccountRef.current) {
      disableServiceAccountRef.current.focus();
    }
  };

  const handleServiceAccountDelete = () => {
    dispatch(deleteServiceAccount(serviceAccount.id));
  };
  const handleServiceAccountDisable = () => {
    dispatch(updateServiceAccount({ ...serviceAccount, isDisabled: true }));
    setShowDisableModal(false);
  };

  const handleServiceAccountEnable = () => {
    dispatch(updateServiceAccount({ ...serviceAccount, isDisabled: false }));
  };

  const handleServiceAccountRoleChange = (role: OrgRole) => {
    dispatch(updateServiceAccount({ ...serviceAccount, role: role }));
  };

  const onServiceAccountNameChange = (newValue: string) => {
    dispatch(updateServiceAccount({ ...serviceAccount, name: newValue }));
  };

  const styles = useStyles2(getStyles);

  return (
    <>
      <div style={{ marginBottom: '10px' }}>
        <a href="org/serviceaccounts" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <Button variant="link" icon="backward" />
        </a>
        <h1
          className="page-heading"
          style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0!important', marginBottom: '0px' }}
        >
          {serviceAccount.name}
        </h1>
      </div>
      <span style={{ marginBottom: '10px' }}>Information</span>
      <div className="gf-form-group">
        <div className="gf-form">
          <table className="filter-table form-inline">
            <tbody>
              <ServiceAccountProfileRow
                label="Name"
                value={serviceAccount.name}
                onChange={onServiceAccountNameChange}
                disabled={!ableToWrite || serviceAccount.isDisabled}
              />
              <ServiceAccountProfileRow label="ID" value={serviceAccount.login} disabled={serviceAccount.isDisabled} />
              <ServiceAccountRoleRow
                label="Roles"
                serviceAccount={serviceAccount}
                onRoleChange={handleServiceAccountRoleChange}
                builtInRoles={builtInRoles}
                roleOptions={roleOptions}
              />
              {/* <ServiceAccountProfileRow label="Teams" value={serviceAccount.teams.join(', ')} /> */}
              <ServiceAccountProfileRow
                label="Creation date"
                value={dateTimeFormat(serviceAccount.createdAt, { timeZone })}
                disabled={serviceAccount.isDisabled}
              />
            </tbody>
          </table>
        </div>
        <div className={styles.buttonRow}>
          <>
            <Button
              type={'button'}
              variant="destructive"
              onClick={showDeleteServiceAccountModal(true)}
              ref={deleteServiceAccountRef}
              disabled={!contextSrv.hasPermission(AccessControlAction.ServiceAccountsDelete)}
            >
              Delete service account
            </Button>
            <ConfirmModal
              isOpen={showDeleteModal}
              title="Delete service account"
              body="Are you sure you want to delete this service account?"
              confirmText="Delete service account"
              onConfirm={handleServiceAccountDelete}
              onDismiss={showDeleteServiceAccountModal(false)}
            />
          </>
          {serviceAccount.isDisabled ? (
            <Button type={'button'} variant="secondary" onClick={handleServiceAccountEnable} disabled={!ableToWrite}>
              Enable service account
            </Button>
          ) : (
            <>
              <Button
                type={'button'}
                variant="secondary"
                onClick={showDisableServiceAccountModal(true)}
                ref={disableServiceAccountRef}
                disabled={!ableToWrite}
              >
                Disable service account
              </Button>
              <ConfirmModal
                isOpen={showDisableModal}
                title="Disable service account"
                body="Are you sure you want to disable this service account?"
                confirmText="Disable service account"
                onConfirm={handleServiceAccountDisable}
                onDismiss={showDisableServiceAccountModal(false)}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    buttonRow: css`
      margin-top: ${theme.spacing(1.5)};
      > * {
        margin-right: ${theme.spacing(2)};
      }
    `,
  };
};
