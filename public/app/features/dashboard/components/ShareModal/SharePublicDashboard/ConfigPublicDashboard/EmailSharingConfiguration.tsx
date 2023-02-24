import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import {
  Button,
  ButtonGroup,
  Field,
  Form,
  Input,
  InputControl,
  RadioButtonGroup,
  Spinner,
  useStyles2,
  VerticalGroup,
} from '@grafana/ui/src';
import {
  useAddEmailSharingMutation,
  useDeleteEmailSharingMutation,
  useGetPublicDashboardQuery,
  useUpdatePublicDashboardMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import { useSelector } from 'app/types';

import { PublicDashboardShareType, validEmailRegex } from '../SharePublicDashboardUtils';

interface EmailSharingConfigurationForm {
  shareType: PublicDashboardShareType;
  email: string;
}

const options: Array<SelectableValue<PublicDashboardShareType>> = [
  { label: 'Anyone with a link', value: PublicDashboardShareType.PUBLIC },
  { label: 'Only specified people', value: PublicDashboardShareType.EMAIL },
];

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard.EmailSharingConfiguration;

export const EmailSharingConfiguration = () => {
  const styles = useStyles2(getStyles);
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel()!;

  const { data: publicDashboard } = useGetPublicDashboardQuery(dashboard.uid);
  const [updateShareType] = useUpdatePublicDashboardMutation();
  const [addEmail, { isLoading: isAddEmailLoading }] = useAddEmailSharingMutation();
  const [deleteEmail, { isLoading: isDeleteLoading }] = useDeleteEmailSharingMutation();

  const onShareTypeChange = (shareType: PublicDashboardShareType) => {
    const req = {
      dashboard,
      payload: {
        ...publicDashboard!,
        share: shareType,
      },
    };

    updateShareType(req);
  };
  const onDeleteEmail = (email: string) => {
    deleteEmail({ recipient: email, dashboardUid: dashboard.uid, uid: publicDashboard!.uid });
  };

  const onSubmit = (data: EmailSharingConfigurationForm) => {
    addEmail({ recipient: data.email, uid: publicDashboard!.uid, dashboardUid: dashboard.uid });
  };

  return (
    <div className={styles.container}>
      <VerticalGroup spacing="sm">
        <Form
          maxWidth="none"
          onSubmit={onSubmit}
          validateOn="onChange"
          defaultValues={{
            shareType: publicDashboard?.share || PublicDashboardShareType.PUBLIC,
            email: '',
          }}
        >
          {({ register, errors, setValue, control, watch, formState: { isValid } }) => (
            <div>
              <Field label="Can view dashboard">
                <InputControl
                  name="shareType"
                  control={control}
                  render={({ field }) => (
                    <RadioButtonGroup
                      {...field}
                      options={options}
                      onChange={(shareType: PublicDashboardShareType) => {
                        setValue('shareType', shareType);
                        onShareTypeChange(shareType);
                      }}
                      data-testid={selectors.ShareType}
                    />
                  )}
                />
              </Field>
              {watch('shareType') === PublicDashboardShareType.EMAIL && (
                <>
                  <Field
                    label="Invite"
                    description="Invite people by email separated by comma "
                    error={errors?.email?.message}
                    invalid={!!errors.email}
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
                        disabled={!isValid || isAddEmailLoading}
                        data-testid={selectors.EmailSharingButton}
                      >
                        Invite {isAddEmailLoading && <Spinner />}
                      </Button>
                    </div>
                  </Field>
                  {!!publicDashboard?.recipients?.length && (
                    <div className={styles.table} data-testid={selectors.EmailSharingList}>
                      <table className="filter-table">
                        <tbody>
                          {publicDashboard.recipients.map((recipient) => (
                            <tr key={recipient}>
                              <td>{recipient}</td>
                              <td>
                                <ButtonGroup className={styles.tableButtonsContainer}>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    fill="text"
                                    aria-label="Revoke"
                                    className={styles.revokeButton}
                                    title="Revoke"
                                    disabled={isDeleteLoading}
                                    onClick={() => onDeleteEmail(recipient)}
                                  >
                                    Revoke
                                  </Button>
                                </ButtonGroup>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Form>
      </VerticalGroup>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  emailContainer: css`
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(1)};
  `,
  emailInput: css`
    flex-grow: 1;
  `,
  table: css`
    width: 100%;
    max-height: 110px;
    overflow-y: scroll;
    margin-bottom: ${theme.spacing(1)};
  `,
  tableButtonsContainer: css`
    display: flex;
    justify-content: end;
  `,
  revokeButton: css`
    padding: 0;
    font-weight: 100;
  `,
});
