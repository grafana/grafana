import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { AsyncSelect, Button, Field, Form, HorizontalGroup, Input, InputControl } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from '../../types';
import { createNotificationChannel } from './state/actions';
import { getBackendSrv } from '@grafana/runtime';

type NotifierType =
  | 'discord'
  | 'hipchat'
  | 'email'
  | 'sensu'
  | 'googlechat'
  | 'threema'
  | 'teams'
  | 'slack'
  | 'pagerduty'
  | 'prometheus-alertmanager'
  | 'telegram'
  | 'opsgenie'
  | 'dingding'
  | 'webhook'
  | 'victorops'
  | 'pushover'
  | 'LINE'
  | 'kafka';

interface Notifier {
  name: string;
  description: string;
  optionsTemplate: string;
  type: NotifierType;
}

interface OwnProps {}

interface ConnectedProps {
  navModel: NavModel;
}

interface DispatchProps {
  createNotificationChannel: typeof createNotificationChannel;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

class NewAlertNotificationPage extends PureComponent<Props> {
  onSubmit = (data: any) => {
    this.props.createNotificationChannel(data);
  };

  loadTypeOptions = async () => {
    console.log('loadoptions');
    const typeOptions: Notifier[] = await getBackendSrv().get(`/api/alert-notifiers`);

    return typeOptions.map((option: Notifier) => {
      return {
        value: `notifier-options-${option.type}`,
        label: option.name,
        description: option.description,
      };
    });
  };

  render() {
    const { navModel } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <h2>New Notification Channel</h2>
          <Form onSubmit={this.onSubmit} validateOn="onChange">
            {({ register, errors, control }) => (
              <>
                <Field label="Name" invalid={!!errors.name} error={errors.name}>
                  <Input name="name" ref={register({ required: 'Name is required' })} />
                </Field>
                <Field label="Type">
                  <InputControl
                    name="type"
                    as={AsyncSelect}
                    defaultOptions
                    loadOptions={this.loadTypeOptions}
                    control={control}
                    rules={{ required: true }}
                    noOptionsMessage="No types found"
                  />
                </Field>
                <HorizontalGroup>
                  <Button type="submit" onClick={this.onSubmit}>
                    Save
                  </Button>
                  <Button type="button" variant="secondary">
                    Test
                  </Button>
                </HorizontalGroup>
              </>
            )}
          </Form>
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {
    navModel: getNavModel(state.navIndex, 'channels'),
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  createNotificationChannel,
};

export default connect(mapStateToProps, mapDispatchToProps)(NewAlertNotificationPage);
