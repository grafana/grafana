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
  useGetPublicDashboardQuery,
  useUpdatePublicDashboardMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import { useSelector } from 'app/types';

import { PublicDashboardShareType } from '../SharePublicDashboardUtils';

interface EmailSharingConfigurationForm {
  shareType: PublicDashboardShareType;
  email: string;
}

const options: Array<SelectableValue<PublicDashboardShareType>> = [
  { label: 'Anyone with a link', value: PublicDashboardShareType.PUBLIC },
  { label: 'Only specified people', value: PublicDashboardShareType.EMAIL },
];

const validEmailRegex = /^[A-Z\d._%+-]+@[A-Z\d.-]+\.[A-Z]{2,}$/i;
const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const EmailSharingConfiguration = () => {
  const styles = useStyles2(getStyles);
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel()!;

  const { data: publicDashboard } = useGetPublicDashboardQuery(dashboard.uid);
  const [update] = useUpdatePublicDashboardMutation();
  const [addEmail, { isLoading: isAddEmailLoading }] = useAddEmailSharingMutation();

  const onShareTypeChange = (shareType: PublicDashboardShareType) => {
    const req = {
      dashboard,
      payload: {
        ...publicDashboard!,
        share: shareType,
      },
    };

    console.log('el req', req);

    update(req);
  };

  const onSubmit = (data: EmailSharingConfigurationForm) => {
    addEmail({ email: data.email, accessToken: publicDashboard!.accessToken!, dashboardUid: dashboard.uid });
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
          {({ register, errors, setValue, control, watch, formState: { isSubmitSuccessful } }) => (
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
                    />
                  )}
                />
              </Field>
              {watch('shareType') === PublicDashboardShareType.EMAIL && (
                <Field
                  label="Invite"
                  description="Invite people by email separated by comma "
                  error={errors?.email?.message}
                  invalid={!!errors.email}
                >
                  <div className={styles.emailContainer}>
                    <Input
                      className={styles.emailInput}
                      // data-testid="requestAccessEmail"
                      placeholder="email"
                      autoCapitalize="none"
                      {...register('email', {
                        required: 'Email is required',
                        pattern: { value: validEmailRegex, message: 'Invalid email' },
                      })}
                    />
                    <Button type="submit" variant="primary">
                      Invite {isAddEmailLoading && <Spinner />}
                    </Button>
                  </div>
                </Field>
              )}
            </div>
          )}
        </Form>
        {!!publicDashboard?.recipients?.length && (
          <table className="filter-table">
            <tbody>
              {publicDashboard.recipients.map((recipient) => (
                <tr key={recipient.uid}>
                  <td>{recipient.recipient}</td>
                  <td>
                    <ButtonGroup
                      className={css`
                        display: flex;
                        justify-content: end;
                      `}
                    >
                      <Button
                        type="button"
                        variant="primary"
                        fill="text"
                        aria-label="Resend"
                        title="Resend"
                        onClick={() => {}}
                      >
                        Revoke
                      </Button>
                    </ButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
});
