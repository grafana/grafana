import React, { PureComponent } from 'react';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Form } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { NotificationChannelForm } from './components/NotificationChannelForm';
import {
  loadNotificationChannel,
  loadNotificationTypes,
  testNotificationChannel,
  updateNotificationChannel,
} from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';
import { selectableChannels, transformSubmitData, transformTestData } from './utils/notificationChannels';
import { NotificationChannelType, NotificationChannelDTO, StoreState } from 'app/types';
import { connectWithCleanUp } from '../../core/components/connectWithCleanUp';
import LoadingIndicator from '@jaegertracing/jaeger-ui-components/src/common/LoadingIndicator';

interface OwnProps {}

interface ConnectedProps {
  navModel: NavModel;
  channelId: number;
  notificationChannel: any;
  notificationChannelTypes: NotificationChannelType[];
}

interface DispatchProps {
  loadNotificationTypes: typeof loadNotificationTypes;
  loadNotificationChannel: typeof loadNotificationChannel;
  testNotificationChannel: typeof testNotificationChannel;
  updateNotificationChannel: typeof updateNotificationChannel;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export class EditNotificationChannelPage extends PureComponent<Props> {
  componentDidMount() {
    const { channelId } = this.props;

    this.props.loadNotificationTypes();
    this.props.loadNotificationChannel(channelId);
  }

  onSubmit = (formData: NotificationChannelDTO) => {
    const { notificationChannel } = this.props;

    this.props.updateNotificationChannel({ ...transformSubmitData(formData), id: notificationChannel.id });
  };

  onTestChannel = (formData: NotificationChannelDTO) => {
    this.props.testNotificationChannel(transformTestData(formData));
  };

  render() {
    const { navModel, notificationChannel, notificationChannelTypes } = this.props;

    const defaultNotificationChannelType = notificationChannelTypes.find(n => n.value === notificationChannel.type);

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <h2>Edit Notification Channel</h2>
          {notificationChannel.id ? (
            <Form
              onSubmit={this.onSubmit}
              defaultValues={{ ...notificationChannel, type: defaultNotificationChannelType }}
            >
              {({ control, errors, getValues, register, watch }) => {
                const selectedChannel = notificationChannelTypes.find(c => c.value === getValues().type.value);

                return (
                  <NotificationChannelForm
                    selectableChannels={selectableChannels(notificationChannelTypes)}
                    selectedChannel={selectedChannel}
                    imageRendererAvailable={config.rendererAvailable}
                    onTestChannel={this.onTestChannel}
                    register={register}
                    watch={watch}
                    errors={errors}
                    getValues={getValues}
                    control={control}
                  />
                );
              }}
            </Form>
          ) : (
            <LoadingIndicator />
          )}
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {
    navModel: getNavModel(state.navIndex, 'channels'),
    channelId: getRouteParamsId(state.location) as number,
    notificationChannel: state.alertRules.notificationChannel,
    notificationChannelTypes: state.alertRules.notificationChannelTypes,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  loadNotificationTypes,
  loadNotificationChannel,
  testNotificationChannel,
  updateNotificationChannel,
};

export default connectWithCleanUp(
  mapStateToProps,
  mapDispatchToProps,
  state => state.alertRules
)(EditNotificationChannelPage);
