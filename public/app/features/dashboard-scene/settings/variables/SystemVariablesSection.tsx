import { css } from '@emotion/css';
import classNames from 'classnames';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { SceneVariable, SceneVariableState } from '@grafana/scenes';
import { CollapsableSection, Icon, Stack, Tooltip, useStyles2, Text } from '@grafana/ui';

import { getPluginNameForControlSource } from '../../utils/dashboardControls';

import { getDefinition } from './utils';

type Props = {
  variables: Array<SceneVariable<SceneVariableState>>;
};

export function SystemVariablesSection({ variables }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <CollapsableSection label={<SystemVariablesSectionLabel />} isOpen={isOpen} onToggle={setIsOpen}>
        <table className={classNames('filter-table', 'filter-table--hover', styles.table)} role="grid">
          <thead>
            <tr>
              <th>
                <Trans i18nKey="dashboard-scene.variable-editor-list.variable">Variable</Trans>
              </th>
              <th>
                <Trans i18nKey="dashboard-scene.variable-editor-list.definition">Definition</Trans>
              </th>
              <th className={styles.thNarrow} />
            </tr>
          </thead>
          <tbody>
            {variables.map((variable, index) => {
              const variableState = variable.state;
              const source = variableState.source;
              const pluginName = getPluginNameForControlSource(source);

              return (
                <tr key={`${variableState.name}-${index}`}>
                  <td role="gridcell" className={styles.nameCell}>
                    {variableState.name}
                  </td>
                  <td role="gridcell" className={styles.definitionColumn}>
                    {getDefinition(variable)}
                  </td>
                  <td role="gridcell" className={styles.sourceCell}>
                    <Tooltip content={getSourceTooltip(pluginName)}>
                      <Icon name="database" className={styles.iconMuted} aria-hidden />
                    </Tooltip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CollapsableSection>
    </div>
  );
}

function SystemVariablesSectionLabel() {
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Text element="h5">
        <Trans i18nKey="dashboard-scene.default-variables-table.heading">System variables</Trans>
      </Text>
      <Tooltip
        content={t(
          'dashboard-scene.default-variables-table.heading-tooltip',
          'These variables are provided by the system and cannot be edited.'
        )}
      >
        <Icon name="info-circle" className={styles.iconMuted} aria-hidden />
      </Tooltip>
    </Stack>
  );
}

function getSourceTooltip(pluginName: string | undefined): string {
  return pluginName
    ? t('dashboard-scene.default-variables-table.added-by-datasource', 'Added by the {{pluginName}} plugin', {
        pluginName,
      })
    : t('dashboard-scene.default-variables-table.added-by-datasource-unknown', 'Added by datasource');
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginTop: theme.spacing(4),
    paddingTop: theme.spacing(4),
  }),
  iconMuted: css({
    color: theme.colors.text.secondary,
  }),
  table: css({
    overflow: 'auto',
  }),
  thNarrow: css({
    width: '1%',
  }),
  nameCell: css({
    width: '1%',
    verticalAlign: 'top',
    color: theme.colors.text.maxContrast,
  }),
  definitionColumn: css({
    width: '100%',
    maxWidth: theme.spacing(25),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  sourceCell: css({
    width: '1%',
  }),
});
