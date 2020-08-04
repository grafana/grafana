import React, { FC } from 'react';
import { connect } from 'react-redux';
import { Form, Field, Input } from '@grafana/ui';
import { getRouteParamsId } from '../../core/selectors/location';
import { getAlertRule } from './state/selectors';
import { updateAlertRule } from './state/actions';
import { AlertRule } from 'app/types';

export interface Props {
  alertRule: AlertRule;
  updateAlertRule: typeof updateAlertRule;
}

const AlertRuleSettings: FC<Props> = ({ alertRule, updateAlertRule }) => {
  return (
    <Form
      defaultValues={{ ...alertRule }}
      onSubmit={(formAlert: AlertRule) => {
        updateAlertRule(formAlert);
      }}
    >
      {({ register }) => (
        <>
          <Field label="Name">
            <Input name="name" ref={register({ required: true })} />
          </Field>
        </>
      )}
    </Form>
  );
};

function mapStateToProps(state: any) {
  const alertId = getRouteParamsId(state.location);

  return {
    alertRule: getAlertRule(state.alertRule, alertId),
  };
}

const mapDispatchToProps = {
  updateAlertRule,
};

export default connect(mapStateToProps, mapDispatchToProps)(AlertRuleSettings);
