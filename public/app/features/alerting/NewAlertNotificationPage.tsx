import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { Field, Form, Input, InputControl } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from '../../types';
import { createNotificationChannel } from './state/actions';

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

  render() {
    const { navModel } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <h2>New Notification Channel</h2>
          <Form onSubmit={this.onSubmit}>
            {({ register, errors, control }) => (
              <>
                <Field label="Name">
                  <Input name="name" ref={register({ required: 'Name is required' })} />
                </Field>
                <Field label="Type">
                  <InputControl as={} />
                </Field>
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
