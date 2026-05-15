import { css } from '@emotion/css';
import classNames from 'classnames';
import { type ReactNode, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { type SceneVariable } from '@grafana/scenes';
import { type ControlSourceRef } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { CollapsableSection, Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { getGlobalSceneVariableScope, isGlobalSceneVariable } from '../utils/globalDashboardVariables';

type Column = {
  i18nKey: string;
  defaultText: string;
};

type Props = {
  columns: Column[];
  children: ReactNode;
};

export function ProvisionedControlsSection({ columns, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <CollapsableSection label={<ProvisionedControlsSectionLabel />} isOpen={isOpen} onToggle={setIsOpen}>
        <table className={classNames('filter-table', 'filter-table--hover', styles.table)} role="grid">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.i18nKey}>
                  <Trans i18nKey={col.i18nKey}>{col.defaultText}</Trans>
                </th>
              ))}
              <th className={styles.thNarrow} />
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </CollapsableSection>
    </div>
  );
}

function ProvisionedControlsSectionLabel() {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Icon name="database" className={styles.iconMuted} />
      <Text variant="h5">
        <Trans i18nKey="dashboard-scene.provisioned-controls-section.label">Provisioned by data source</Trans>
      </Text>
    </Stack>
  );
}

export function SourceIcon({
  origin,
  variable,
}: {
  origin: ControlSourceRef | undefined;
  /**
   * When provided, the icon consults the global-variables registry to render a
   * distinct badge for runtime-only globals. Pass `undefined` for non-variable sources
   * (e.g. provisioned dashboard links), which never have a global equivalent.
   */
  variable?: SceneVariable;
}) {
  const styles = useStyles2(getStyles);
  const pluginName = usePluginName(origin, variable);
  const isGlobal = variable !== undefined && isGlobalSceneVariable(variable);

  if (isGlobal) {
    const scope = (variable && getGlobalSceneVariableScope(variable)) || 'org';
    return (
      <Tooltip
        content={t(
          'dashboard-scene.provisioned-controls-section.tooltip-global-variable',
          'Global or folder variable ({{scope}})',
          { scope }
        )}
      >
        <Icon name="filter" className={styles.iconMuted} aria-hidden />
      </Tooltip>
    );
  }

  return (
    <Tooltip content={getSourceTooltip(pluginName)}>
      <Icon name="database" className={styles.iconMuted} aria-hidden />
    </Tooltip>
  );
}

function getSourceTooltip(pluginName: string | undefined): string {
  if (pluginName) {
    return t('dashboard-scene.provisioned-controls-section.tooltip', 'Added by the {{pluginName}} plugin', {
      pluginName,
    });
  }
  return t('dashboard-scene.provisioned-controls-section.tooltip-unknown', 'Added by a data source plugin');
}

function usePluginName(origin: ControlSourceRef | undefined, variable?: SceneVariable): string | undefined {
  const isGlobal = variable !== undefined && isGlobalSceneVariable(variable);
  return useMemo(() => {
    if (!origin?.group || isGlobal) {
      return undefined;
    }

    const list = getDataSourceSrv().getList({});
    const ds = list.find((d) => d.meta.id === origin.group);
    return ds?.meta.name ?? origin.group;
  }, [origin?.group, isGlobal]);
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginTop: theme.spacing(3),
  }),
  table: css({
    width: '100%',
  }),
  thNarrow: css({
    width: '1%',
  }),
  iconMuted: css({
    color: theme.colors.text.secondary,
  }),
});
