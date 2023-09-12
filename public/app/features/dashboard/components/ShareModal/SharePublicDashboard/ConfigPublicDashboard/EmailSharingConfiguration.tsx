import { css } from '@emotion/css';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useWindowSize } from 'react-use';

import { GrafanaTheme2, SelectableValue } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { FieldSet } from '@grafana/ui';
import {
  Button,
  ButtonGroup,
  Field,
  Input,
  InputControl,
  RadioButtonGroup,
  Spinner,
  useStyles2,
} from '@grafana/ui/src';
import { contextSrv } from 'app/core/services/context_srv';
import {
  useAddRecipientMutation,
  useDeleteRecipientMutation,
  useGetPublicDashboardQuery,
  useReshareAccessToRecipientMutation,
  useUpdatePublicDashboardMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import { isOrgAdmin } from 'app/features/plugins/admin/permissions';
import { AccessControlAction, useSelector } from 'app/types';

import { trackDashboardSharingActionPerType } from '../../analytics';
import { shareDashboardType } from '../../utils';
import { PublicDashboard, PublicDashboardShareType, validEmailRegex } from '../SharePublicDashboardUtils';

interface EmailSharingConfigurationForm {
  shareType: PublicDashboardShareType;
  email: string;
}

const options: Array<SelectableValue<PublicDashboardShareType>> = [
  { label: 'Anyone with a link', value: PublicDashboardShareType.PUBLIC },
  { label: 'Only specified people', value: PublicDashboardShareType.EMAIL },
];

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard.EmailSharingConfiguration;

const EmailList = ({
  recipients,
  dashboardUid,
  publicDashboardUid,
}: {
  recipients: PublicDashboard['recipients'];
  dashboardUid: string;
  publicDashboardUid: string;
}) => {
  const styles = useStyles2(getStyles);
  const [deleteEmail, { isLoading: isDeleteLoading }] = useDeleteRecipientMutation();
  const [reshareAccess, { isLoading: isReshareLoading }] = useReshareAccessToRecipientMutation();

  const isLoading = isDeleteLoading || isReshareLoading;

  const onDeleteEmail = (recipientUid: string) => {
    trackDashboardSharingActionPerType('delete_email', shareDashboardType.publicDashboard);
    deleteEmail({ recipientUid, dashboardUid: dashboardUid, uid: publicDashboardUid });
  };

  const onReshare = (recipientUid: string) => {
    trackDashboardSharingActionPerType('reshare_email', shareDashboardType.publicDashboard);
    reshareAccess({ recipientUid, uid: publicDashboardUid });
  };

  return (
    <table className={styles.table} data-testid={selectors.EmailSharingList}>
      <tbody>
        {recipients!.map((recipient, idx) => (
          <tr key={recipient.uid}>
            <td>{recipient.recipient}</td>
            <td>
              <ButtonGroup className={styles.tableButtonsContainer}>
                <Button
                  type="button"
                  variant="destructive"
                  fill="text"
                  aria-label="Revoke"
                  title="Revoke"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => onDeleteEmail(recipient.uid)}
                  data-testid={`${selectors.DeleteEmail}-${idx}`}
                >
                  Revoke
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  fill="text"
                  aria-label="Resend"
                  title="Resend"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => onReshare(recipient.uid)}
                  data-testid={`${selectors.ReshareLink}-${idx}`}
                >
                  Resend
                </Button>
              </ButtonGroup>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const EmailSharingConfiguration = () => {
  const { width } = useWindowSize();
  const styles = useStyles2(getStyles);
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel()!;

  const { data: publicDashboard } = useGetPublicDashboardQuery(dashboard.uid);
  const [updateShareType] = useUpdatePublicDashboardMutation();
  const [addEmail, { isLoading: isAddEmailLoading }] = useAddRecipientMutation();

  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());

  const {
    register,
    setValue,
    control,
    watch,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EmailSharingConfigurationForm>({
    defaultValues: {
      shareType: publicDashboard?.share || PublicDashboardShareType.PUBLIC,
      email: '',
    },
    mode: 'onSubmit',
  });

  const onUpdateShareType = (shareType: PublicDashboardShareType) => {
    const req = {
      dashboard,
      payload: {
        ...publicDashboard!,
        share: shareType,
      },
    };

    updateShareType(req);
  };

  const onSubmit = async (data: EmailSharingConfigurationForm) => {
    //TODO: add if it's domain or not when developed.
    trackDashboardSharingActionPerType('invite_email', shareDashboardType.publicDashboard);
    await addEmail({ recipient: data.email, uid: publicDashboard!.uid, dashboardUid: dashboard.uid }).unwrap();
    reset({ email: '', shareType: PublicDashboardShareType.EMAIL });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldSet disabled={!hasWritePermissions} data-testid={selectors.Container} className={styles.container}>
        <Field label="Can view dashboard" className={styles.field}>
          <InputControl
            name="shareType"
            control={control}
            render={({ field }) => {
              const { ref, ...rest } = field;
              return (
                <RadioButtonGroup
                  {...rest}
                  size={width < 480 ? 'sm' : 'md'}
                  options={options}
                  onChange={(shareType: PublicDashboardShareType) => {
                    trackDashboardSharingActionPerType(
                      `share_type_${shareType === PublicDashboardShareType.EMAIL ? 'email' : 'public'}`,
                      shareDashboardType.publicDashboard
                    );
                    setValue('shareType', shareType);
                    onUpdateShareType(shareType);
                  }}
                />
              );
            }}
          />
        </Field>
        {watch('shareType') === PublicDashboardShareType.EMAIL && (
          <>
            <Field
              label="Invite"
              description="Invite people by email"
              error={errors.email?.message}
              invalid={!!errors.email?.message || undefined}
              className={styles.field}
            >
              <div className={styles.emailContainer}>
                <Input
                  className={styles.emailInput}
                  placeholder="email"
                  autoCapitalize="none"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: validEmailRegex, message: 'Invalid email' },
                  })}
                  data-testid={selectors.EmailSharingInput}
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isAddEmailLoading}
                  data-testid={selectors.EmailSharingInviteButton}
                >
                  Invite {isAddEmailLoading && <Spinner />}
                </Button>
              </div>
            </Field>
            {!!publicDashboard?.recipients?.length && (
              <EmailList
                recipients={publicDashboard.recipients}
                dashboardUid={dashboard.uid}
                publicDashboardUid={publicDashboard.uid}
              />
            )}
          </>
        )}
      </FieldSet>
    </form>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    label: emailConfigContainer;
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    gap: ${theme.spacing(3)};
  `,
  field: css`
    label: field-noMargin;
    margin-bottom: 0;
  `,
  emailContainer: css`
    label: emailContainer;
    display: flex;
    gap: ${theme.spacing(1)};
  `,
  emailInput: css`
    label: emailInput;
    flex-grow: 1;
  `,
  table: css`
    label: table;
    display: flex;
    max-height: 220px;
    overflow-y: scroll;

    & tbody {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }

    & tr {
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.spacing(0.5, 1)};

      :nth-child(odd) {
        background: ${theme.colors.background.secondary};
      }
    }
  `,
  tableButtonsContainer: css`
    display: flex;
    justify-content: end;
  `,
});
