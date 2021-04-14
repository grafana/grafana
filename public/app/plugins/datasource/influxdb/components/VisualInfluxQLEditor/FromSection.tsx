import React, { FC } from 'react';
import { SegmentAsync } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

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
  getAllPolicies: () => Promise<string[]>;
  getAllMeasurements: () => Promise<string[]>;
};

export const FromSection: FC<Props> = ({ policy, measurement, onChange, getAllPolicies, getAllMeasurements }) => {
  const handlePolicyLoadOptions = async () => {
    const allPolicies = await getAllPolicies();
    const allPoliciesOptions = allPolicies.map((item) => ({
      label: item,
      value: item,
    }));

    // if `default` does not exist in the list of policies, we add it
    return allPoliciesOptions.some((p) => p.value === 'default')
      ? allPoliciesOptions
      : [DEFAULT_POLICY, allPoliciesOptions];
  };

  const handleMeasurementLoadOptions = async () => {
    const allMeasurements = await getAllMeasurements();
    return allMeasurements.map((item) => ({
      label: item,
      value: item,
    }));
  };

  const policyValue = isDefaultPolicy(policy) ? DEFAULT_POLICY.value : policy;
  return (
    <div className="gf-form-inline">
      <label className="gf-form-label query-keyword width-9">From</label>
      <SegmentAsync
        value={policyValue}
        loadOptions={handlePolicyLoadOptions}
        onChange={(v) => {
          onChange(v.value, measurement);
        }}
      />
      <SegmentAsync
        placeholder="select measurement"
        value={measurement}
        loadOptions={handleMeasurementLoadOptions}
        onChange={(v) => {
          onChange(policy, v.value);
        }}
      />
      <div className="gf-form gf-form--grow">
        <label className="gf-form-label gf-form-label--grow"></label>
      </div>
    </div>
  );
};
