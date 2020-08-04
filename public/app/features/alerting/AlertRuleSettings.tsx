import React, { FC } from 'react';
import { connect } from 'react-redux';
import { Form, Field, Input, Select } from '@grafana/ui';
import { getRouteParamsId } from '../../core/selectors/location';
import { getAlertRule } from './state/selectors';
import { updateAlertRule } from './state/actions';
import { AlertRule, NoDataState, ExecutionErrorState } from 'app/types';

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
            <Input className="width-20" name="name" ref={register({ required: true })} />
          </Field>
          <Field label="Evaluate every">
            <Input className="max-width-6" name="frequency" ref={register} />
          </Field>
          <Field label="For">
            <Input className="max-width-6" name="for" placeholder="5m" ref={register} />
          </Field>
          <Field>
            <Select
              isSearchable={false}
              options={Object.keys(NoDataState).map(key => ({ label: key, value: key }))}
              onChange={() => {}}
              className="gf-form-select-box__control--menu-right"
            />
          </Field>
          <Field>
            <Select
              isSearchable={false}
              options={Object.keys(ExecutionErrorState).map(key => ({ label: key, value: key }))}
              onChange={() => {}}
              className="gf-form-select-box__control--menu-right"
            />
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
