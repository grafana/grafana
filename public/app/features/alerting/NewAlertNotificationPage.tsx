import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { NavModel, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Form } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { NewNotificationChannelForm } from './components/NewNotificationChannelForm';
import { getNavModel } from 'app/core/selectors/navModel';
import { createNotificationChannel, loadNotificationTypes, testNotificationChannel } from './state/actions';
import { NotificationChannel, NotificationChannelDTO, StoreState } from '../../types';

interface OwnProps {}

interface ConnectedProps {
  navModel: NavModel;
  notificationChannels: NotificationChannel[];
}

interface DispatchProps {
  createNotificationChannel: typeof createNotificationChannel;
  loadNotificationTypes: typeof loadNotificationTypes;
  testNotificationChannel: typeof testNotificationChannel;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

const defaultValues: NotificationChannelDTO = {
  name: '',
  type: { value: 'email', label: 'Email' },
  sendReminder: false,
  disableResolveMessage: false,
  frequency: '15m',
  settings: {
    uploadImage: config.rendererAvailable,
    autoResolve: true,
    httpMethod: 'POST',
    severity: 'critical',
  },
  isDefault: false,
};

class NewAlertNotificationPage extends PureComponent<Props> {
  componentDidMount() {
    this.props.loadNotificationTypes();
  }

  onSubmit = (data: NotificationChannelDTO) => {
    /*
      Some settings can be options in a select, in order to not save a SelectableValue<T>
      we need to use check if it is a SelectableValue and use its value.
    */
    const settings = Object.fromEntries(
      Object.entries(data.settings).map(([key, value]) => {
        return [key, value.hasOwnProperty('value') ? value.value : value];
      })
    );

    this.props.createNotificationChannel({
      ...defaultValues,
      ...data,
      type: data.type.value,
      settings: { ...defaultValues.settings, ...settings },
    });
  };

  onTestChannel = (data: NotificationChannelDTO) => {
    this.props.testNotificationChannel({
      name: data.name,
      type: data.type.value,
      frequency: data.frequency ?? defaultValues.frequency,
      settings: { ...Object.assign(defaultValues.settings, data.settings) },
    });
  };

  render() {
    const { navModel, notificationChannels } = this.props;

    /*
     Need to transform these as we have options on notificationChannels,
     this will render a dropdown within the select.

    TODO: Memoize?
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
              const selectedChannel = notificationChannels.find(c => c.value === getValues().type.value);

              return (
                <NewNotificationChannelForm
                  selectableChannels={selectableChannels}
                  selectedChannel={selectedChannel}
                  onTestChannel={this.onTestChannel}
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
  testNotificationChannel,
};

export default connect(mapStateToProps, mapDispatchToProps)(NewAlertNotificationPage);
