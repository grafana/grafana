import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { PanelContainer, useStyles2, InfoBox } from '@grafana/ui';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';

import { Wizard } from '../components/Wizard';
import { useCorrelations } from '../useCorrelations';

import { ConfigureCorrelationBasicInfoForm } from './ConfigureCorrelationBasicInfoForm';
import { ConfigureCorrelationSourceForm } from './ConfigureCorrelationSourceForm';
import { ConfigureCorrelationTargetForm } from './ConfigureCorrelationTargetForm';
import { CorrelationFormNavigation } from './CorrelationFormNavigation';
import { CorrelationsFormContextProvider } from './correlationsFormContext';
import { FormDTO } from './types';

const getStyles = (theme: GrafanaTheme2) => ({
  panelContainer: css`
    position: relative;
    padding: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(2)};
  `,
});

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export const AddCorrelationForm = ({ onClose, onCreated }: Props) => {
  const styles = useStyles2(getStyles);

  const {
    create: { execute, loading, error, value },
  } = useCorrelations();

  useEffect(() => {
    if (!error && !loading && value) {
      onCreated();
    }
  }, [error, loading, value, onCreated]);

  const defaultValues: Partial<FormDTO> = { config: { type: 'query', target: {}, field: '' } };

  return (
    <PanelContainer className={styles.panelContainer}>
      <CloseButton onClick={onClose} />
      <InfoBox title="Add a new correlation" urlTitle="Documentation" url="about:blank">
        <p>
          This wizard will guide you through setting up a new correlation. Based on the setup Grafana will create
          interactive links in the result panels in Explore.
        </p>
        <p>
          You can specify the behavior of these links. Link will be shown in results of selected origin data source. The
          link will be attached to the field with provided name. Clicking on a link will run a provided target query. To
          build a target query you can extract data from the origin results.
        </p>
      </InfoBox>
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
