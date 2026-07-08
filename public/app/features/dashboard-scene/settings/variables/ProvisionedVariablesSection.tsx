import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { type SceneVariable } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { isPredefinedOrigin } from '../../utils/predefinedVariables';
import { PredefinedControlsSectionLabel, ProvisionedControlsSection, SourceIcon } from '../ProvisionedControlsSection';

import { getDefinition } from './utils';

const VARIABLE_COLUMNS = [
  { i18nKey: 'dashboard-scene.variable-editor-list.variable', defaultText: 'Variable' },
  { i18nKey: 'dashboard-scene.variable-editor-list.definition', defaultText: 'Definition' },
];

export function ProvisionedVariablesSection({ variables }: { variables: SceneVariable[] }) {
  const predefinedVariables = variables.filter((v) => isPredefinedOrigin(v.state.origin));
  const provisionedVariables = variables.filter((v) => !isPredefinedOrigin(v.state.origin));

  return (
    <>
      {predefinedVariables.length > 0 && (
        <ProvisionedControlsSection columns={VARIABLE_COLUMNS} label={<PredefinedControlsSectionLabel />}>
          <VariableRows variables={predefinedVariables} />
        </ProvisionedControlsSection>
      )}
      {provisionedVariables.length > 0 && (
        <ProvisionedControlsSection columns={VARIABLE_COLUMNS}>
          <VariableRows variables={provisionedVariables} />
        </ProvisionedControlsSection>
      )}
    </>
  );
}

function VariableRows({ variables }: { variables: SceneVariable[] }) {
  const styles = useStyles2(getStyles);

  return (
    <>
      {variables.map((variable, index) => {
        const variableState = variable.state;

        return (
          <tr key={`${variableState.name}-${index}`}>
            <td role="gridcell" className={styles.nameCell}>
              {variableState.name}
            </td>
            <td role="gridcell" className={styles.definitionColumn}>
              {getDefinition(variable)}
            </td>
            <td role="gridcell" className={styles.sourceCell}>
              <SourceIcon origin={variableState.origin} />
            </td>
          </tr>
        );
      })}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  nameCell: css({
    fontWeight: theme.typography.fontWeightMedium,
    width: '20%',
  }),
  definitionColumn: css({
    width: '70%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 0,
  }),
  sourceCell: css({
    width: '1%',
    textAlign: 'center' as const,
  }),
});
