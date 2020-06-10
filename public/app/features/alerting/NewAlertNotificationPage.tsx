import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { NavModel, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Form } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { NewNotificationChannelForm } from './components/NewNotificationChannelForm';
import { getNavModel } from 'app/core/selectors/navModel';
import { createNotificationChannel, loadNotificationTypes } from './state/actions';
import { NotificationChannel, NotificationChannelDTO, StoreState } from '../../types';

interface OwnProps {}

interface ConnectedProps {
  navModel: NavModel;
  notificationChannels: NotificationChannel[];
}

interface DispatchProps {
  createNotificationChannel: typeof createNotificationChannel;
  loadNotificationTypes: typeof loadNotificationTypes;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

const examplePost = {
  disableResolveMessage: false,
  frequency: '15m',
  isDefault: false,
  name: 'Email2',
  sendReminder: false,
  settings: {
    addresses: 'peter.holmberg@grafana.com',
    autoResolve: true,
    httpMethod: 'POST',
    severity: 'critical',
    uploadImage: false,
  },
  type: 'email',
};

const actual = {
  disableResolveMessage: false,
  isDefault: false,
  name: 'test',
  sendReminder: false,
  settings: {
    addresses: 'asdf',
    singleEmail: false,
  },
  type: {
    label: 'Email',
    value: 'notifier-options-email',
  },
  uploadImage: false,
};

const defaultValues: NotificationChannelDTO = {
  name: '',
  type: { value: 'notifier-options-email', label: 'Email' },
  sendReminder: false,
  disableResolveMessage: false,
  frequency: '15m',
  settings: [],
  uploadImage: config.rendererAvailable,
  isDefault: false,
};

const defaultSettings = {};

class NewAlertNotificationPage extends PureComponent<Props> {
  componentDidMount() {
    this.props.loadNotificationTypes();
  }

  onSubmit = (data: NotificationChannelDTO) => {
    console.log({
      ...data,
      type: data.type.label.toLowerCase(),
      settings: { ...Object.assign(defaultValues.settings, data.settings) },
    });
  };

  render() {
    const { navModel, notificationChannels } = this.props;

    /*
     Need to transform these as we have options on notificationChannels,
     this will render a dropdown within the select
   */
    const selectableChannels: Array<SelectableValue<string>> = notificationChannels.map(channel => ({
      value: channel.value,
      label: channel.label,
      description: channel.description,
    }));

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <h2>New Notification Channel</h2>
          <Form onSubmit={this.onSubmit} validateOn="onChange" defaultValues={defaultValues}>
            {({ register, errors, control, getValues, watch }) => {
              const selectedChannel =
                getValues().type && notificationChannels.find(c => c.value === getValues().type.value);

              return (
                <NewNotificationChannelForm
                  selectableChannels={selectableChannels}
                  selectedChannel={selectedChannel}
                  onSubmit={this.onSubmit}
                  register={register}
                  errors={errors}
                  getValues={getValues}
                  control={control}
                  watch={watch}
                  imageRendererAvailable={config.rendererAvailable}
                />
              );
            }}
          </Form>
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {
    navModel: getNavModel(state.navIndex, 'channels'),
    notificationChannels: state.alertRules.notificationChannels,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  createNotificationChannel,
  loadNotificationTypes,
};

export default connect(mapStateToProps, mapDispatchToProps)(NewAlertNotificationPage);
