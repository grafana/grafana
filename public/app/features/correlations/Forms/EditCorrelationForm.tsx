import React, { useEffect } from 'react';

import { Wizard } from '../components/Wizard';
import { Correlation } from '../types';
import { useCorrelations } from '../useCorrelations';

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

export const EditCorrelationForm = ({ onUpdated, correlation, readOnly = false }: Props) => {
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
