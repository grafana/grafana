import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneVariable } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { ProvisionedControlsSection, SourceIcon } from '../ProvisionedControlsSection';

import { getDefinition } from './utils';

const VARIABLE_COLUMNS = [
  { i18nKey: 'dashboard-scene.variable-editor-list.variable', defaultText: 'Variable' },
  { i18nKey: 'dashboard-scene.variable-editor-list.definition', defaultText: 'Definition' },
];

export function ProvisionedVariablesSection({ variables }: { variables: SceneVariable[] }) {
  const styles = useStyles2(getStyles);

  return (
    <ProvisionedControlsSection columns={VARIABLE_COLUMNS}>
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
    </ProvisionedControlsSection>
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
