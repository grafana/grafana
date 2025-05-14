import { AccessoryButton } from '@grafana/plugin-ui';

import { DEFAULT_POLICY } from '../../../../../types';
import { toSelectableValue } from '../utils/toSelectableValue';

import { Seg } from './Seg';

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

type Props = {
  onChange: (policy: string | undefined, measurement: string | undefined) => void;
  policy: string | undefined;
  measurement: string | undefined;
  getPolicyOptions: () => Promise<string[]>;
  getMeasurementOptions: (filter: string) => Promise<string[]>;
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
    // if `default` does not exist in the list of policies, we add it
    const allPoliciesWithDefault = allPolicies.some((p) => p === DEFAULT_POLICY)
      ? allPolicies
      : [DEFAULT_POLICY, ...allPolicies];

    return allPoliciesWithDefault.map(toSelectableValue);
  };

  const handleMeasurementLoadOptions = async (filter: string) => {
    const allMeasurements = await getMeasurementOptions(filter);
    return allMeasurements.map(toSelectableValue);
  };

  return (
    <>
      <Seg
        allowCustomValue
        value={policy ?? 'using default policy'}
        loadOptions={handlePolicyLoadOptions}
        onChange={(v) => {
          onChange(v.value, measurement);
        }}
      />
      <Seg
        allowCustomValue
        value={measurement ?? 'select measurement'}
        loadOptions={handleMeasurementLoadOptions}
        filterByLoadOptions
        onChange={(v) => {
          onChange(policy, v.value);
        }}
      />
      {measurement && (
        <AccessoryButton
          style={{ marginRight: '4px' }}
          aria-label="remove"
          icon="times"
          variant="secondary"
          onClick={() => {
            onChange(policy, undefined);
          }}
        />
      )}
    </>
  );
};
