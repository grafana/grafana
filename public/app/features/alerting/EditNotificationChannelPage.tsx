import React, { PureComponent } from 'react';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Form, Spinner } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { connectWithCleanUp } from 'app/core/components/connectWithCleanUp';
import { NotificationChannelForm } from './components/NotificationChannelForm';
import { loadNotificationChannel, testNotificationChannel, updateNotificationChannel } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';
import { mapChannelsToSelectableValue, transformSubmitData, transformTestData } from './utils/notificationChannels';
import { NotificationChannelType, NotificationChannelDTO, StoreState } from 'app/types';
import { resetSecureField } from './state/reducers';

interface OwnProps {}

interface ConnectedProps {
  navModel: NavModel;
  channelId: number;
  notificationChannel: any;
  notificationChannelTypes: NotificationChannelType[];
}

interface DispatchProps {
  loadNotificationChannel: typeof loadNotificationChannel;
  testNotificationChannel: typeof testNotificationChannel;
  updateNotificationChannel: typeof updateNotificationChannel;
  resetSecureField: typeof resetSecureField;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export class EditNotificationChannelPage extends PureComponent<Props> {
  componentDidMount() {
    const { channelId } = this.props;

    this.props.loadNotificationChannel(channelId);
  }

  onSubmit = (formData: NotificationChannelDTO) => {
    const { notificationChannel } = this.props;

    this.props.updateNotificationChannel({
      /*
       Some settings which lives in a collapsed section will not be registered since
       the section will not be rendered if a user doesn't expand it. Therefore we need to
       merge the initialData with any changes from the form.
      */
      ...transformSubmitData({
        ...notificationChannel,
        ...formData,
        settings: { ...notificationChannel.settings, ...formData.settings },
      }),
      id: notificationChannel.id,
    });
  };

  onTestChannel = (formData: NotificationChannelDTO) => {
    const { notificationChannel } = this.props;
    /*
      Same as submit
     */
    this.props.testNotificationChannel(
      transformTestData({
        ...notificationChannel,
        ...formData,
        settings: { ...notificationChannel.settings, ...formData.settings },
      })
    );
  };

  render() {
    const { navModel, notificationChannel, notificationChannelTypes } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <h2 className="page-sub-heading">Edit notification channel</h2>
          {notificationChannel && notificationChannel.id > 0 ? (
            <Form
              maxWidth={600}
              onSubmit={this.onSubmit}
              defaultValues={{
                ...notificationChannel,
                type: notificationChannelTypes.find(n => n.value === notificationChannel.type),
              }}
            >
              {({ control, errors, getValues, register, watch }) => {
                const selectedChannel = notificationChannelTypes.find(c => c.value === getValues().type.value);

                return (
                  <NotificationChannelForm
                    selectableChannels={mapChannelsToSelectableValue(notificationChannelTypes)}
                    selectedChannel={selectedChannel}
                    imageRendererAvailable={config.rendererAvailable}
                    onTestChannel={this.onTestChannel}
                    register={register}
                    watch={watch}
                    errors={errors}
                    getValues={getValues}
                    control={control}
                    resetSecureField={this.props.resetSecureField}
                    secureFields={notificationChannel.secureFields}
                  />
                );
              }}
            </Form>
          ) : (
            <div>
              Loading notification channel
              <Spinner />
            </div>
          )}
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  const channelId = getRouteParamsId(state.location) as number;
  return {
    navModel: getNavModel(state.navIndex, 'channels'),
    channelId,
    notificationChannel: state.notificationChannel.notificationChannel,
    notificationChannelTypes: state.notificationChannel.notificationChannelTypes,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  loadNotificationChannel,
  testNotificationChannel,
  updateNotificationChannel,
  resetSecureField,
};

export default connectWithCleanUp(
  mapStateToProps,
  mapDispatchToProps,
  state => state.notificationChannel
)(EditNotificationChannelPage);
