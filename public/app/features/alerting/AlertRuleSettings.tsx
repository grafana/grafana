import React, { FC } from 'react';
import { connect } from 'react-redux';
import { Form, Field, Input } from '@grafana/ui';
import { getRouteParamsId } from '../../core/selectors/location';
import { getAlert } from './state/selectors';
import { updateAlertRule } from './state/actions';
import { AlertRule } from 'app/types';

export interface Props {
  alertName: string;
  updateAlertRule: typeof updateAlertRule;
}

const AlertRuleSettings: FC<Props> = ({ alertName, updateAlertRule }) => {
  return (
    <Form
      defaultValues={{ ...alert }}
      onSubmit={(formAlert: AlertRule) => {
        updateAlertRule(formAlert);
      }}
    >
      {({ register }) => (
        <>
          <Field label="Name">
            <Input type="text" name="name" value={alertName} placeholder="Name" />
          </Field>
        </>
      )}
    </Form>
  );
};

function mapStateToProps(state: any) {
  const alertId = getRouteParamsId(state.location);

  return {
    alert: getAlert(state.alert, alertId),
  };
}

const mapDispatchToProps = {
  updateAlertRule,
};

export default connect(mapStateToProps, mapDispatchToProps)(AlertRuleSettings);
