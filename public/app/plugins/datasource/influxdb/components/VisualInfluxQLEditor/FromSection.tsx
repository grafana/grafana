import React from 'react';
import { SegmentAsync } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { toSelectableValue } from './toSelectableValue';

const DEFAULT_POLICY: SelectableValue<string> = {
  label: 'using default policy',
  value: 'default',
};

// we use the value "default" as a magic-value, it means
// we use the default retention-policy.
// unfortunately, IF the user has a retention-policy named "default",
// and it is not the default-retention-policy in influxdb,
// bad things will happen.
// https://github.com/grafana/grafana/issues/4347 :-(
// FIXME: we could maybe at least detect here that problem-is-happening,
// and show an error message or something.
// unfortunately, currently the ResponseParser does not return the
// is-default info for the retention-policies, so that should change first.
const isDefaultPolicy = (policy: string | undefined) => {
  return policy == null || policy === 'default';
};

type Props = {
  onChange: (policy: string | undefined, measurement: string | undefined) => void;
  policy: string | undefined;
  measurement: string | undefined;
  getPolicyOptions: () => Promise<string[]>;
  getMeasurementOptions: () => Promise<string[]>;
};

export const FromSection = ({
  policy,
  measurement,
  onChange,
  getPolicyOptions,
  getMeasurementOptions,
}: Props): JSX.Element => {
  const handlePolicyLoadOptions = async () => {
    const allPolicies = await getPolicyOptions();
    const allPoliciesOptions = allPolicies.map(toSelectableValue);

    // if `default` does not exist in the list of policies, we add it
    return allPoliciesOptions.some((p) => p.value === 'default')
      ? allPoliciesOptions
      : [DEFAULT_POLICY, allPoliciesOptions];
  };

  const handleMeasurementLoadOptions = async () => {
    const allMeasurements = await getMeasurementOptions();
    return allMeasurements.map(toSelectableValue);
  };

  const policyValue = isDefaultPolicy(policy) ? DEFAULT_POLICY.value : policy;
  return (
    <>
      <SegmentAsync
        allowCustomValue
        value={policyValue}
        loadOptions={handlePolicyLoadOptions}
        onChange={(v) => {
          onChange(v.value, measurement);
        }}
      />
      <SegmentAsync
        allowCustomValue
        placeholder="select measurement"
        value={measurement}
        loadOptions={handleMeasurementLoadOptions}
        onChange={(v) => {
          onChange(policy, v.value);
        }}
      />
    </>
  );
};
