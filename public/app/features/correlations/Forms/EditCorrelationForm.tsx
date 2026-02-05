import { useEffect } from 'react';

import { useUpdateCorrelationMutation } from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { config } from '@grafana/runtime';

import { Wizard } from '../components/Wizard/Wizard';
import { Correlation } from '../types';
import { useCorrelations } from '../useCorrelations';
import { generatePartialEditSpec } from '../utils';

import { ConfigureCorrelationBasicInfoForm } from './ConfigureCorrelationBasicInfoForm';
import { ConfigureCorrelationSourceForm } from './ConfigureCorrelationSourceForm';
import { ConfigureCorrelationTargetForm } from './ConfigureCorrelationTargetForm';
import { CorrelationFormNavigation } from './CorrelationFormNavigation';
import { CorrelationsFormContextProvider } from './correlationsFormContext';
import { EditFormDTO } from './types';

interface Props {
  onUpdated: () => void;
  correlation: Correlation;
  readOnly?: boolean;
}

export const EditCorrelationFormWrapper = ({ onUpdated, correlation, readOnly = false }: Props) => {
  if (config.featureToggles.kubernetesCorrelations) {
    return <EditCorrelationFormAppPlatform onUpdated={onUpdated} correlation={correlation} readOnly={readOnly} />;
  }

  return <EditCorrelationFormLegacy onUpdated={onUpdated} correlation={correlation} readOnly={readOnly} />;
};

const EditCorrelationFormLegacy = ({ onUpdated, correlation, readOnly = false }: Props) => {
  const {
    update: { execute, loading, error, value },
  } = useCorrelations();

  const onSubmit = (data: EditFormDTO) => {
    return execute({ ...data, sourceUID: correlation.sourceUID, uid: correlation.uid });
  };

  useEffect(() => {
    if (!error && !loading && value) {
      onUpdated();
    }
  }, [error, loading, value, onUpdated]);

  return (
    <CorrelationsFormContextProvider data={{ loading, readOnly, correlation }}>
      <Wizard<EditFormDTO>
        defaultValues={correlation}
        pages={[ConfigureCorrelationBasicInfoForm, ConfigureCorrelationTargetForm, ConfigureCorrelationSourceForm]}
        onSubmit={readOnly ? (e) => () => {} : onSubmit}
        navigation={CorrelationFormNavigation}
      />
    </CorrelationsFormContextProvider>
  );
};

const EditCorrelationFormAppPlatform = ({ onUpdated, correlation, readOnly = false }: Props) => {
  const [update, { isLoading, error, data }] = useUpdateCorrelationMutation();

  // we use PATCH/update and build a partial spec here because PUT/replace requires us to specify
  // the full app platform correlation including the api version and metadata,
  // which we do not store in the frontend
  const onSubmit = (data: EditFormDTO) => {
    return update({ name: correlation.uid, patch: { spec: generatePartialEditSpec(data, correlation) } });
  };

  useEffect(() => {
    if (!error && !isLoading && data) {
      onUpdated();
    }
  }, [error, onUpdated, isLoading, data]);

  return (
    <CorrelationsFormContextProvider data={{ loading: isLoading, readOnly, correlation }}>
      <Wizard<EditFormDTO>
        defaultValues={correlation}
        pages={[ConfigureCorrelationBasicInfoForm, ConfigureCorrelationTargetForm, ConfigureCorrelationSourceForm]}
        onSubmit={readOnly ? (e) => () => {} : onSubmit}
        navigation={CorrelationFormNavigation}
      />
    </CorrelationsFormContextProvider>
  );
};
