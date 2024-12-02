import { css } from '@emotion/css';
import { ReactElement, useEffect, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { SceneVariable, SceneVariableState } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema/dist/esm/index.gen';
import { CollapsableSection, Icon, Spinner, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { VariableUsagesButton } from '../../variables/VariableUsagesButton';
import { getUnknownsNetwork, UsagesToNetwork } from '../../variables/utils';

export const SLOW_VARIABLES_EXPANSION_THRESHOLD = 1000;

export interface VariablesUnknownTableProps {
  variables: Array<SceneVariable<SceneVariableState>>;
  dashboard: Dashboard | null;
}

export function VariablesUnknownTable({ variables, dashboard }: VariablesUnknownTableProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [changed, setChanged] = useState(0);
  const style = useStyles2(getStyles);

  useEffect(() => setChanged((prevState) => prevState + 1), [variables, dashboard]);

  const [{ loading, value: usages }, getUnknowns] = useAsyncFn(async () => {
    const start = Date.now();
    const unknownsNetwork = await getUnknownsNetwork(variables, dashboard);
    const stop = Date.now();
    const elapsed = stop - start;
    if (elapsed >= SLOW_VARIABLES_EXPANSION_THRESHOLD) {
      reportInteraction('Slow unknown variables expansion', { elapsed });
    }
    setChanged(0);

    return unknownsNetwork;
  }, [variables, dashboard]);

  const onToggle = (isOpen: boolean) => {
    if (isOpen) {
      reportInteraction('Unknown variables section expanded');

      // make sure we only fetch when opened and variables or dashboard have changed
      if (changed > 0) {
        getUnknowns();
      }
    }

    setOpen(isOpen);
  };

  return (
    <div className={style.container}>
      <CollapsableSection label={<CollapseLabel />} isOpen={open} onToggle={onToggle}>
        {loading || !usages ? (
          <Stack justifyContent="center" direction="column">
            <Stack justifyContent="center">
              <span>
                <Trans i18nKey="variables.unknown-table.loading">Loading...</Trans>
              </span>
              <Spinner />
            </Stack>
          </Stack>
        ) : usages.length > 0 ? (
          <UnknownTable usages={usages} />
        ) : (
          <NoUnknowns />
        )}
      </CollapsableSection>
    </div>
  );
}

function CollapseLabel(): ReactElement {
  const style = useStyles2(getStyles);
  return (
    <h5>
      <Trans i18nKey="variables.unknown-table.renamed-or-missing-variables">Renamed or missing variables</Trans>
      <Tooltip content="Click to expand a list with all variable references that have been renamed or are missing from the dashboard.">
        <Icon name="info-circle" className={style.infoIcon} />
      </Tooltip>
    </h5>
  );
}

function NoUnknowns(): ReactElement {
  return (
    <span>
      <Trans i18nKey="variables.unknown-table.no-unknowns">No renamed or missing variables found.</Trans>
    </span>
  );
}

function UnknownTable({ usages }: { usages: UsagesToNetwork[] }): ReactElement {
  const style = useStyles2(getStyles);
  return (
    <table className="filter-table filter-table--hover">
      <thead>
        <tr>
          <th>
            <Trans i18nKey="variables.unknown-table.variable">Variable</Trans>
          </th>
          <th colSpan={5} />
        </tr>
      </thead>
      <tbody>
        {usages.map((usage) => {
          const name = typeof usage.variable === 'string' ? usage.variable : usage.variable.state.name;
          return (
            <tr key={name}>
              <td className={style.firstColumn}>
                <span>{name}</span>
              </td>
              <td className={style.defaultColumn} />
              <td className={style.defaultColumn} />
              <td className={style.defaultColumn} />
              <td className={style.lastColumn}>
                <VariableUsagesButton id={name} usages={usages} isAdhoc={false} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginTop: theme.spacing(4),
    paddingTop: theme.spacing(4),
  }),
  infoIcon: css({
    marginLeft: theme.spacing(1),
  }),
  defaultColumn: css({
    width: '1%',
  }),
  firstColumn: css({
    width: '1%',
    verticalAlign: 'top',
    color: theme.colors.text.maxContrast,
  }),
  lastColumn: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
    textAlign: 'right',
  }),
});
