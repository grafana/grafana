import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { type SceneVariable } from '@grafana/scenes';
import { CollapsableSection, Stack, Text, useStyles2 } from '@grafana/ui';

import { isPredefinedOrigin } from '../../utils/predefinedVariables';
import { PredefinedControlsSectionLabel, SourceIcon } from '../ProvisionedControlsSection';

interface ReadOnlyVariablesSectionProps {
  variables: SceneVariable[];
}

export function ReadOnlyVariablesSection({ variables }: ReadOnlyVariablesSectionProps) {
  const styles = useStyles2(getStyles);
  const hasPredefined = variables.some((v) => isPredefinedOrigin(v.state.origin));

  return (
    <CollapsableSection
      label={
        hasPredefined ? (
          <PredefinedControlsSectionLabel />
        ) : (
          <Text variant="h6" color="secondary">
            <Trans i18nKey="dashboard-scene.read-only-variables-section.label">Provisioned variables</Trans>
          </Text>
        )
      }
      isOpen={false}
    >
      <Stack direction="column" gap={0.5}>
        {variables.map((variable) => (
          <div key={variable.state.key ?? variable.state.name} className={styles.item}>
            <Text color="secondary">${variable.state.name}</Text>
            <SourceIcon origin={variable.state.origin} />
          </div>
        ))}
      </Stack>
    </CollapsableSection>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    item: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 0),
      color: theme.colors.text.secondary,
    }),
  };
}
