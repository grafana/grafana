import React, { FC } from 'react';
import { Button, Field, FieldSet, Form, Icon, Input, Tooltip } from '@grafana/ui';
import config from 'app/core/config';
import { BaselineEntryFields } from './types';

export interface Props {
  isSavingBaselineEntry: boolean;
  addBaselineEntry: (payload: BaselineEntryFields) => void;
}

const { disableLoginForm } = config;

export const BaselineEntryForm: FC<Props> = ({ isSavingBaselineEntry, addBaselineEntry }) => {
  const onSubmitBaselineEntry = (data: BaselineEntryFields) => {
    addBaselineEntry(data);
    clearForm();
  };
  const clearForm = () => {
    (document.getElementById('baseline-entry-form') as HTMLInputElement & {
      reset: () => boolean;
    }).reset();
  };

  return (
    <Form id="baseline-entry-form" className="baseline-entry-form" onSubmit={onSubmitBaselineEntry} validateOn="onBlur">
      {({ register, errors }) => {
        return (
          <FieldSet className="baseline-field-set">
            <div className="baseline-field-group">
              <Field
                className="baseline-field"
                label="Start Date"
                invalid={!!errors.startDate}
                error="Start Date is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('startDate', { required: true })}
                  id="edit-baseline-start-date"
                  placeholder="Start Date"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="End Date"
                invalid={!!errors.endDate}
                error="End Date is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('endDate', { required: true })}
                  id="edit-baseline-end-date"
                  placeholder="End Date"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="Kilowatt-hour (kWh)"
                invalid={!!errors.kwh}
                error="kWh is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('kwh', { required: true })}
                  id="edit-baseline-kwh"
                  placeholder="kwh"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="Minimum kW"
                invalid={!!errors.minKw}
                error="Min. kW is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('minKw', { required: true })}
                  id="edit-baseline-min-kw"
                  placeholder="Min. kW"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="Maximum kW"
                invalid={!!errors.maxKw}
                error="Max. kW is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('maxKw', { required: true })}
                  id="edit-baseline-max-kw"
                  placeholder="Max. kW"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
            </div>
            <div className="baseline-field-group">
              <Field
                className="baseline-field"
                label="Average kW"
                invalid={!!errors.avgKw}
                error="Average kW is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('avgKw', { required: true })}
                  id="edit-baseline-avg-kw"
                  placeholder="Average kW"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="Average kVA"
                invalid={!!errors.avgKva}
                error="Average kVA is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('avgKva', { required: true })}
                  id="edit-baseline-avg-kva"
                  placeholder="Average kVA"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="Power Factor (PF)"
                invalid={!!errors.pf}
                error="PF is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('pf', { required: true })}
                  id="edit-baseline-pf"
                  placeholder="PF"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="Minimum PF"
                invalid={!!errors.minPf}
                error="Min. PF is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('minPf', { required: true })}
                  id="edit-baseline-min-pf"
                  placeholder="Min. PF"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="Maximum PF"
                invalid={!!errors.maxPf}
                error="Max. PF is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('maxPf', { required: true })}
                  id="edit-baseline-max-pf"
                  placeholder="Max. PF"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
            </div>
            <div className="baseline-field-group">
              <Field
                className="baseline-field"
                label="Rate"
                invalid={!!errors.rate}
                error="Rate is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('rate', { required: true })}
                  id="edit-baseline-rate"
                  placeholder="Rate"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="Energy Rate"
                invalid={!!errors.energyRate}
                error="Energy Rate is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('energyRate', { required: true })}
                  id="edit-baseline-energy-rate"
                  placeholder="Energy Rate"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="Fuel Rate"
                invalid={!!errors.fuelRate}
                error="Fuel Rate is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('fuelRate', { required: true })}
                  id="edit-baseline-fuel-rate"
                  placeholder="Fuel Rate"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="Fuel & IPP Rate"
                invalid={!!errors.ippRate}
                error="Fuel & IPP Rate is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('ippRate', { required: true })}
                  id="edit-baseline-ipp-rate"
                  placeholder="Fuel & IPP Rate"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="IPP Variable Rate"
                invalid={!!errors.ippVariableRate}
                error="IPP Variable Rate is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('ippVariableRate', { required: true })}
                  id="edit-baseline-ipp-variable-rate"
                  placeholder="IPP Variable Rate"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
            </div>
            <div className="baseline-field-group">
              <Field
                className="baseline-field"
                label="IPP Variable Charge"
                invalid={!!errors.ippVariableCharge}
                error="IPP Variable Charge is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('ippVariableCharge', { required: true })}
                  id="edit-baseline-ipp-variable-charge"
                  placeholder="IPP Variable Charge"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="Energy Charge"
                invalid={!!errors.energyCharge}
                error="Energy Charge is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('energyCharge', { required: true })}
                  id="edit-baseline-energy-charge"
                  placeholder="Energy Charge"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <Field
                className="baseline-field"
                label="Current Charges"
                invalid={!!errors.currentCharges}
                error="Current Charges is required"
                disabled={isSavingBaselineEntry}
              >
                <Input
                  {...register('currentCharges', { required: true })}
                  id="edit-baseline-current-charge"
                  placeholder="Current Charges"
                  defaultValue={''}
                  suffix={<InputSuffix />}
                />
              </Field>
              <div className="gf-form-button-row">
                <Button variant="primary" disabled={isSavingBaselineEntry} aria-label="Baseline entry submit button">
                  Submit
                </Button>
              </div>
            </div>
          </FieldSet>
        );
      }}
    </Form>
  );
};

export default BaselineEntryForm;

const InputSuffix: FC = () => {
  return disableLoginForm ? (
    <Tooltip content="Login details locked because they are managed in another system.">
      <Icon name="lock" />
    </Tooltip>
  ) : null;
};
