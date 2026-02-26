import { css } from '@emotion/css';
import { useEffect } from 'react';

import { useCreateCorrelationMutation } from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { PanelContainer, useStyles2 } from '@grafana/ui';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';

import { Wizard } from '../components/Wizard/Wizard';
import { useCorrelations } from '../useCorrelations';
import { generateAddSpec } from '../utils';

import { ConfigureCorrelationBasicInfoForm } from './ConfigureCorrelationBasicInfoForm';
import { ConfigureCorrelationSourceForm } from './ConfigureCorrelationSourceForm';
import { ConfigureCorrelationTargetForm } from './ConfigureCorrelationTargetForm';
import { CorrelationFormNavigation } from './CorrelationFormNavigation';
import { CorrelationsFormContextProvider } from './correlationsFormContext';
import { FormDTO } from './types';

const getStyles = (theme: GrafanaTheme2) => ({
  panelContainer: css({
    position: 'relative',
    padding: theme.spacing(1),
    marginBottom: theme.spacing(2),
  }),
  infoBox: css({
    marginTop: '20px', // give space for close button
  }),
});

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export const AddCorrelationFormWrapper = ({ onClose, onCreated }: Props) => {
  if (config.featureToggles.kubernetesCorrelations) {
    return <AddCorrelationFormAppPlatform onClose={onClose} onCreated={onCreated} />;
  }

  return <AddCorrelationFormLegacy onClose={onClose} onCreated={onCreated} />;
};

export const AddCorrelationFormAppPlatform = ({ onClose, onCreated }: Props) => {
  const styles = useStyles2(getStyles);

  const [createCorrelation, { data, isLoading, isError }] = useCreateCorrelationMutation();

  useEffect(() => {
    if (!isError && !isLoading && data) {
      onCreated();
    }
  }, [onCreated, isError, isLoading, data]);

  const defaultValues: Partial<FormDTO> = { type: 'query', config: { target: {}, field: '' } };

  const onSubmit = async (data: FormDTO) => {
    const corrSpec = await generateAddSpec(data);
    return createCorrelation({
      correlation: {
        metadata: {},
        apiVersion: 'correlations.grafana.app/v0alpha1',
        kind: 'Correlation',
        spec: corrSpec,
      },
    });
  };

  return (
    <PanelContainer className={styles.panelContainer}>
      <CloseButton onClick={onClose} />
      <CorrelationsFormContextProvider data={{ loading: isLoading, readOnly: false, correlation: undefined }}>
        <Wizard<FormDTO>
          defaultValues={defaultValues}
          pages={[ConfigureCorrelationBasicInfoForm, ConfigureCorrelationTargetForm, ConfigureCorrelationSourceForm]}
          navigation={CorrelationFormNavigation}
          onSubmit={onSubmit}
        />
      </CorrelationsFormContextProvider>
    </PanelContainer>
  );
};

export const AddCorrelationFormLegacy = ({ onClose, onCreated }: Props) => {
  const styles = useStyles2(getStyles);

  const {
    create: { execute, loading, error, value },
  } = useCorrelations();

  useEffect(() => {
    if (!error && !loading && value) {
      onCreated();
    }
  }, [error, loading, value, onCreated]);

  const defaultValues: Partial<FormDTO> = { type: 'query', config: { target: {}, field: '' } };

  return (
    <PanelContainer className={styles.panelContainer}>
      <CloseButton onClick={onClose} />
      <CorrelationsFormContextProvider data={{ loading, readOnly: false, correlation: undefined }}>
        <Wizard<FormDTO>
          defaultValues={defaultValues}
          pages={[ConfigureCorrelationBasicInfoForm, ConfigureCorrelationTargetForm, ConfigureCorrelationSourceForm]}
          navigation={CorrelationFormNavigation}
          onSubmit={execute}
        />
      </CorrelationsFormContextProvider>
    </PanelContainer>
  );
};
