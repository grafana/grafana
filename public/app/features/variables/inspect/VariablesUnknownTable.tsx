import { css } from '@emotion/css';
import { ReactElement, useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { CollapsableSection, Icon, Spinner, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { DashboardModel } from '../../dashboard/state/DashboardModel';
import { VariableModel } from '../types';

import { VariablesUnknownButton } from './VariablesUnknownButton';
import { getUnknownsNetwork, UsagesToNetwork } from './utils';

export const SLOW_VARIABLES_EXPANSION_THRESHOLD = 1000;

export interface VariablesUnknownTableProps {
  variables: VariableModel[];
  dashboard: DashboardModel | null;
}

export function VariablesUnknownTable({ variables, dashboard }: VariablesUnknownTableProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [changed, setChanged] = useState(0);
  const [usages, setUsages] = useState<UsagesToNetwork[]>([]);
  const style = useStyles2(getStyles);
  useEffect(() => setChanged((prevState) => prevState + 1), [variables, dashboard]);
  const { loading } = useAsync(async () => {
    if (open && changed > 0) {
      // make sure we only fetch when opened and variables or dashboard have changed
      const start = Date.now();
      const unknownsNetwork = await getUnknownsNetwork(variables, dashboard);
      const stop = Date.now();
      const elapsed = stop - start;
      if (elapsed >= SLOW_VARIABLES_EXPANSION_THRESHOLD) {
        reportInteraction('Slow unknown variables expansion', { elapsed });
      }
      setChanged(0);
      setUsages(unknownsNetwork);
      return unknownsNetwork;
    }

    return [];
  }, [variables, dashboard, open, changed]);

  const onToggle = (isOpen: boolean) => {
    if (isOpen) {
      reportInteraction('Unknown variables section expanded');
    }

    setOpen(isOpen);
  };

  return (
    <div className={style.container}>
      <CollapsableSection label={<CollapseLabel />} isOpen={open} onToggle={onToggle}>
        {loading && (
          <Stack direction="column" justifyContent="center">
            <Stack justifyContent="center">
              <span>
                <Trans i18nKey="variables.variables-unknown-table.loading">Loading...</Trans>
              </span>
              <Spinner />
            </Stack>
          </Stack>
        )}
        {!loading && usages && (
          <>
            {usages.length === 0 && <NoUnknowns />}
            {usages.length > 0 && <UnknownTable usages={usages} />}
          </>
        )}
      </CollapsableSection>
    </div>
  );
}

function CollapseLabel(): ReactElement {
  const style = useStyles2(getStyles);

  return (
    <h5>
      <Trans i18nKey="variables.variables-unknown-table.collapse-label">Renamed or missing variables</Trans>
      <Tooltip
        content={t(
          'variables.variables-unknown-table.collapse-tooltip',
          'Click to expand a list with all variable references that have been renamed or are missing from the dashboard.'
        )}
      >
        <Icon name="info-circle" className={style.infoIcon} />
      </Tooltip>
    </h5>
  );
}

function NoUnknowns(): ReactElement {
  return (
    <span>
      <Trans i18nKey="variables.no-unknowns.no-renamed-or-missing-variables-found">
        No renamed or missing variables found.
      </Trans>
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
          const { variable } = usage;
          const { id, name } = variable;
          return (
            <tr key={id}>
              <td className={style.firstColumn}>
                <span>{name}</span>
              </td>
              <td className={style.defaultColumn} />
              <td className={style.defaultColumn} />
              <td className={style.defaultColumn} />
              <td className={style.lastColumn}>
                <VariablesUnknownButton id={variable.id} usages={usages} />
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
