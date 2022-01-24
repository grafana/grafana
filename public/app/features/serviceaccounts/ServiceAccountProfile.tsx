import React, { PureComponent, useRef, useState } from 'react';
import { ServiceAccountDTO } from 'app/types';
import { css, cx } from '@emotion/css';
import { config } from 'app/core/config';
import { GrafanaTheme } from '@grafana/data';
import { Button, ConfirmButton, ConfirmModal, Input, LegacyInputStatus, stylesFactory } from '@grafana/ui';

interface Props {
  serviceaccount: ServiceAccountDTO;

  onServiceAccountUpdate: (serviceaccount: ServiceAccountDTO) => void;
  onServiceAccountDelete: (serviceaccountId: number) => void;
  onServiceAccountDisable: (serviceaccountId: number) => void;
  onServiceAccountEnable: (serviceaccountId: number) => void;
}

export function ServiceAccountProfile({
  serviceaccount,
  onServiceAccountUpdate,
  onServiceAccountDelete,
  onServiceAccountDisable,
  onServiceAccountEnable,
}: Props) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);

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

  const handleServiceAccountDelete = () => onServiceAccountDelete(serviceaccount.userId);

  const handleServiceAccountDisable = () => onServiceAccountDisable(serviceaccount.userId);

  const handleServiceAccountEnable = () => onServiceAccountEnable(serviceaccount.userId);

  const onServiceAccountNameChange = (newValue: string) => {
    onServiceAccountUpdate({
      ...serviceaccount,
      name: newValue,
    });
  };

  const styles = getStyles(config.theme);

  return (
    <>
      <h3 className="page-heading">Service account information</h3>
      <div className="gf-form-group">
        <div className="gf-form">
          <table className="filter-table form-inline">
            <tbody>
              <ServiceAccountProfileRow
                label="Display Name"
                value={serviceaccount.name}
                onChange={onServiceAccountNameChange}
              />
              <ServiceAccountProfileRow label="ID" value={serviceaccount.login} />
              <ServiceAccountProfileRow label="Roles" value="WIP" />
              <ServiceAccountProfileRow label="Teams" value="WIP" />
              <ServiceAccountProfileRow label="Created by" value="WIP" />
              <ServiceAccountProfileRow label="Creation date" value="WIP" />
            </tbody>
          </table>
        </div>
        <div className={styles.buttonRow}>
          <>
            <Button variant="destructive" onClick={showDeleteServiceAccountModal(true)} ref={deleteServiceAccountRef}>
              Delete service account
            </Button>
            <ConfirmModal
              isOpen={showDeleteModal}
              title="Delete serviceaccount"
              body="Are you sure you want to delete this serviceaccount?"
              confirmText="Delete serviceaccount"
              onConfirm={handleServiceAccountDelete}
              onDismiss={showDeleteServiceAccountModal(false)}
            />
          </>
          <Button variant="secondary" onClick={handleServiceAccountEnable}>
            Enable service account
          </Button>
          <>
            <Button variant="secondary" onClick={showDisableServiceAccountModal(true)} ref={disableServiceAccountRef}>
              Disable service account
            </Button>
            <ConfirmModal
              isOpen={showDisableModal}
              title="Disable serviceaccount"
              body="Are you sure you want to disable this serviceaccount?"
              confirmText="Disable serviceaccount"
              onConfirm={handleServiceAccountDisable}
              onDismiss={showDisableServiceAccountModal(false)}
            />
          </>
        </div>
      </div>
    </>
  );
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    buttonRow: css`
      margin-top: 0.8rem;
      > * {
        margin-right: 16px;
      }
    `,
  };
});

interface ServiceAccountProfileRowProps {
  label: string;
  value?: string;
  inputType?: string;
  onChange?: (value: string) => void;
}

interface ServiceAccountProfileRowState {
  value: string;
  editing: boolean;
}

export class ServiceAccountProfileRow extends PureComponent<
  ServiceAccountProfileRowProps,
  ServiceAccountProfileRowState
> {
  inputElem?: HTMLInputElement;

  static defaultProps: Partial<ServiceAccountProfileRowProps> = {
    value: '',
    inputType: 'text',
  };

  state = {
    editing: false,
    value: this.props.value || '',
  };

  setInputElem = (elem: any) => {
    this.inputElem = elem;
  };

  onEditClick = () => {
    this.setState({ editing: true }, this.focusInput);
  };

  onCancelClick = () => {
    this.setState({ editing: false, value: this.props.value || '' });
  };

  onInputChange = (event: React.ChangeEvent<HTMLInputElement>, status?: LegacyInputStatus) => {
    if (status === LegacyInputStatus.Invalid) {
      return;
    }

    this.setState({ value: event.target.value });
  };

  onInputBlur = (event: React.FocusEvent<HTMLInputElement>, status?: LegacyInputStatus) => {
    if (status === LegacyInputStatus.Invalid) {
      return;
    }

    this.setState({ value: event.target.value });
  };

  focusInput = () => {
    if (this.inputElem && this.inputElem.focus) {
      this.inputElem.focus();
    }
  };

  onSave = () => {
    if (this.props.onChange) {
      this.props.onChange(this.state.value);
    }
  };

  render() {
    const { label, inputType } = this.props;
    const { value } = this.state;
    const labelClass = cx(
      'width-16',
      css`
        font-weight: 500;
      `
    );

    const inputId = `${label}-input`;
    return (
      <tr>
        <td className={labelClass}>
          <label htmlFor={inputId}>{label}</label>
        </td>
        <td className="width-25" colSpan={2}>
          {this.state.editing ? (
            <Input
              id={inputId}
              type={inputType}
              defaultValue={value}
              onBlur={this.onInputBlur}
              onChange={this.onInputChange}
              ref={this.setInputElem}
              width={30}
            />
          ) : (
            <span>{this.props.value}</span>
          )}
        </td>
        <td>
          <ConfirmButton
            confirmText="Save"
            onClick={this.onEditClick}
            onConfirm={this.onSave}
            onCancel={this.onCancelClick}
          >
            Edit
          </ConfirmButton>
        </td>
      </tr>
    );
  }
}
