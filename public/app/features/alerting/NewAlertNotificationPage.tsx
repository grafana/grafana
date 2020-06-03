import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { Form } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { createNotificationChannel, loadNotificationTypes } from './state/actions';
import { NotificationChannel, StoreState } from '../../types';
import { NewNotificationChannelForm } from './components/NewNotificationChannelForm';

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

class NewAlertNotificationPage extends PureComponent<Props> {
  componentDidMount() {
    this.props.loadNotificationTypes();
  }

  onSubmit = (data: any) => {
    this.props.createNotificationChannel(data);
  };

  render() {
    const { navModel, notificationChannels } = this.props;
    const selectableChannels = notificationChannels.map(channel => {
      return {
        value: channel.value,
        label: channel.label,
        description: channel.description,
      };
    });

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <h2>New Notification Channel</h2>
          <Form onSubmit={this.onSubmit} validateOn="onChange">
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
