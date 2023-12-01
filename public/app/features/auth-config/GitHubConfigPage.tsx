import React, { useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { AppEvents, NavModelItem } from '@grafana/data';
import { getAppEvents, getBackendSrv, isFetchError } from '@grafana/runtime';
import { Button, Field, Form, Input, InputControl, LinkButton, Select, Stack, Switch } from '@grafana/ui';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';
import { Page } from 'app/core/components/Page/Page';

import { StoreState } from '../../types';

import { SSOProviderDTO } from './types';
import { dataToDTO, dtoToData } from './utils';

const appEvents = getAppEvents();
const pageNav: NavModelItem = {
  text: 'GitHub',
  subTitle:
    'To configure GitHub OAuth2 you must register your application with GitHub. GitHub will generate a Client ID and Client Secret for you to use.',
  icon: 'github',
  id: 'GitHub',
};

type ProviderData = Pick<SSOProviderDTO, 'clientId' | 'clientSecret' | 'enabled' | 'teamIds' | 'allowedOrganizations'>;

const connector = connect(mapStateToProps, null);
export type Props = ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  const settings = state.authConfig.providers.find(({ provider }) => provider === 'github');
  return {
    settings,
  };
}

export const GitHubConfigPage = ({ settings }: Props) => {
  return (
    <Page navId="authentication" pageNav={pageNav}>
      <GitHubConfig settings={settings} />
    </Page>
  );
};

export default connector(GitHubConfigPage);

export const GitHubConfig = ({ settings }: Props) => {
  const [isSaving, setIsSaving] = useState(false);
  const handleSubmit = async (data: ProviderData) => {
    setIsSaving(true);
    const requestData = dtoToData<ProviderData>(data, settings);
    try {
      await getBackendSrv().post('/api/v1/sso-settings', requestData);
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Settings saved'],
      });
    } catch (error) {
      let message = '';
      if (isFetchError(error)) {
        message = error.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [message],
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Page.Contents>
      <Stack grow={1} direction={'column'}>
        <Form onSubmit={handleSubmit} defaultValues={dataToDTO(settings)}>
          {({ register, errors, control, setValue, watch, formState }) => {
            const teamIdOptions = watch('teamIds');
            const orgOptions = watch('allowedOrganizations');
            return (
              <>
                <FormPrompt confirmRedirect={formState.isDirty} onDiscard={() => {}} />
                <Field label="Enabled">
                  <Switch {...register('enabled')} id="enabled" label={'Enabled'} />
                </Field>
                <Field label="Client ID" required invalid={!!errors.clientId} error="This field is required">
                  <Input {...register('clientId', { required: true })} type="text" id="clientId" />
                </Field>
                <Field label="Client secret" required invalid={!!errors.clientId} error="This field is required">
                  <Input {...register('clientSecret', { required: true })} type="text" id="clientSecret" />
                </Field>
                <Field label="Team IDs" htmlFor={'teamIds'}>
                  <InputControl
                    name={'teamIds'}
                    control={control}
                    render={({ field: { ref, onChange, ...fieldProps } }) => {
                      return (
                        <Select
                          {...fieldProps}
                          placeholder={'Enter team IDs and press Enter to add'}
                          isMulti
                          inputId={'teamIds'}
                          options={teamIdOptions}
                          allowCustomValue
                          onChange={onChange}
                          onCreateOption={(v) => {
                            const customValue = { value: v, label: v };
                            onChange([...teamIdOptions, customValue]);
                          }}
                        />
                      );
                    }}
                  />
                </Field>

                <Field label="Allowed organizations" htmlFor={'allowedOrganizations'}>
                  <InputControl
                    name={'allowedOrganizations'}
                    control={control}
                    render={({ field: { ref, onChange, ...fieldProps } }) => {
                      return (
                        <Select
                          {...fieldProps}
                          placeholder={'Enter organizations (my-team, myteam...) and press Enter to add'}
                          isMulti
                          inputId={'allowedOrganizations'}
                          options={orgOptions}
                          allowCustomValue
                          onChange={onChange}
                          onCreateOption={(v) => {
                            const customValue = { value: v, label: v };
                            onChange([...orgOptions, customValue]);
                          }}
                        />
                      );
                    }}
                  />
                </Field>
                <Stack gap={2}>
                  <Field>
                    <Button type={'submit'}>{isSaving ? 'Saving...' : 'Save'}</Button>
                  </Field>
                  <Field>
                    <LinkButton href={'/admin/authentication'} variant={'secondary'}>
                      Discard
                    </LinkButton>
                  </Field>
                </Stack>
              </>
            );
          }}
        </Form>
      </Stack>
    </Page.Contents>
  );
};
