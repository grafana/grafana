import { AsyncSelect, Button, Checkbox, Field, HorizontalGroup, Modal, useStyles } from '@grafana/ui';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { css } from 'emotion';
import { QueryVariableModel, VariableModel } from 'app/features/variables/types';

import { useAsyncFn } from 'react-use';
import { SearchSrv } from 'app/core/services/search_srv';
import { DashboardSearchItemType } from 'app/features/search/types';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardModel } from 'app/features/dashboard/state';

export interface VarImportModalProps {
  panelVars: VariableModel[];
  dashboard: DashboardModel;
  onSubmit: (newVars: VariableModel[]) => void;
  onDismiss?: () => void;
  isOpen?: boolean;
}

const varDef = (v?: QueryVariableModel) => {
  if (v === undefined) {
    return '';
  }

  return v.definition ? v.definition : typeof v.query === 'string' ? v.query : '';
};

export const VarImportModal: FC<VarImportModalProps> = ({ panelVars, dashboard, onDismiss, onSubmit, isOpen }) => {
  const styles = useStyles(getStyles);
  const searchSrv = useMemo(() => new SearchSrv(), []);
  const [selectedDash, setSelectedDash] = useState<undefined | SelectableValue<string>>(undefined);
  const [, searchDashboards] = useAsyncFn(
    async (query = ''): Promise<Array<SelectableValue<string>>> => {
      const res = await searchSrv.search({
        query,
        type: DashboardSearchItemType.DashDB,
        skipRecent: true,
        skipStarred: true,
      });
      return res?.[0].items
        .map((v: any) => ({ value: v.uid, label: v.title }))
        .filter((v: any) => v.value !== dashboard.uid);
    }
  );

  const [clashingVars, safeVars] = useMemo(() => {
    const dashVars = dashboard.templating.list as VariableModel[];
    const dashVarMap = dashVars.reduce((acc, cur) => {
      acc[cur.name] = cur;
      return acc;
    }, {} as Record<string, VariableModel>);

    const clashes = [];
    const safe = [];
    for (const panelVar of panelVars) {
      if (dashVarMap[panelVar.name] !== undefined) {
        clashes.push(dashVarMap[panelVar.name]);
      } else {
        safe.push(panelVar);
      }
    }
    return [clashes, safe];
  }, [panelVars]);
  const [checkedVars, setCheckedVars] = useState<boolean[]>(clashingVars.map(() => false));

  const [dashVars, fetchDashVars] = useAsyncFn(async (dashUid: string) => {
    const dash = await backendSrv.getDashboardByUid(dashUid);
    const dashModel = dash.dashboard as DashboardModel;
    const sourceVars = dashModel.templating.list as VariableModel[];
    const sourceVarsMap = sourceVars.reduce((acc, cur) => {
      acc[cur.name] = cur;
      return acc;
    }, {} as Record<string, VariableModel>);
    return sourceVarsMap;
  }, []);

  const onDashboardSelect = useCallback(async (selectedDash: SelectableValue<string>) => {
    setSelectedDash(selectedDash);
    await fetchDashVars(selectedDash.value!);
  }, []);

  const submitNewVars = useCallback(() => {
    const selected = clashingVars.filter((v, i) => checkedVars[i]);
    const newVars = [...safeVars, ...selected].map((v) => dashVars.value?.[v.name]).filter((v) => v !== undefined);
    onSubmit(newVars as VariableModel[]);
  }, [dashVars.value, checkedVars, clashingVars, safeVars]);

  const selectedCount = checkedVars.reduce((total, cur) => total + Number(cur), 0);
  return (
    <Modal icon="x" title="Template variables will be imported" onDismiss={onDismiss} isOpen={isOpen}>
      <Field label="Dashboard">
        <AsyncSelect
          defaultOptions={true}
          loadOptions={searchDashboards}
          onChange={onDashboardSelect}
          value={selectedDash}
        />
      </Field>

      {clashingVars.length > 0 && (
        <>
          <p>
            The library panel is trying to import some template variables. There are{' '}
            <em className={styles.emph}>conflicts with some of the definitions</em>. Check which variables you want to
            overwrite with the definition from the selected dashboard:
          </p>
          <Checkbox
            label={selectedCount === 0 ? 'Select all' : `${selectedCount} selected`}
            onClick={() => {
              setCheckedVars(checkedVars.map(() => !(selectedCount === checkedVars.length)));
            }}
            value={selectedCount === checkedVars.length}
            className={styles.selectAll}
          />
          <table className={styles.dataTable}>
            <thead>
              <tr className={styles.rowHeader}>
                <th></th>
                <th>Variable</th>
                <th>Current definition</th>
                <th>Definition in selected dashboard</th>
              </tr>
            </thead>
            <tbody>
              {clashingVars.map((v, i) => (
                <tr key={i}>
                  <td>
                    <Checkbox
                      className={styles.checkbox}
                      checked={checkedVars[i]}
                      onClick={() =>
                        setCheckedVars([...checkedVars.slice(0, i), !checkedVars[i], ...checkedVars.slice(i + 1)])
                      }
                    />
                  </td>
                  <td>{v.name}</td>
                  <td>{varDef(v as QueryVariableModel)}</td>
                  <td>{varDef(dashVars.value?.[v.name] as QueryVariableModel) ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {safeVars.length > 0 && (
        <>
          <p className={styles.p}>The following {safeVars.length} template variables will be imported:</p>
          <table className={styles.dataTable}>
            <thead>
              <tr className={styles.rowHeader}>
                <th>Variable</th>
                <th>Definition in selected dashboard</th>
              </tr>
            </thead>
            <tbody>
              {safeVars.map((v, i) => (
                <tr key={i}>
                  <td>{v.name}</td>
                  <td>{varDef(dashVars.value?.[v.name] as QueryVariableModel) ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <HorizontalGroup>
        <Button onClick={submitNewVars}>Import template variables and add panel</Button>
        <Button variant="secondary" onClick={onDismiss}>
          Cancel
        </Button>
      </HorizontalGroup>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  emph: css`
    font-weight: ${theme.typography.weight.bold};
    font-style: normal;
  `,
  selectAll: css`
    margin-left: ${theme.spacing.sm};
  `,
  checkbox: css`
    margin-top: -20px;
  `,
  table: css`
    width: 100%;
  `,
  p: css`
    margin-top: ${theme.spacing.md};
    margin-bottom: ${theme.spacing.md};
  `,
  rowHeader: css`
    font-size: ${theme.typography.size.sm};
    font-weight: ${theme.typography.weight.bold};
    color: ${theme.colors.textSemiWeak};
    height: ${theme.spacing.xl};
    min-height: ${theme.spacing.xl};
    max-height: ${theme.spacing.xl};
    > th {
      height: ${theme.spacing.xl};
      min-height: ${theme.spacing.xl};
      max-height: ${theme.spacing.xl};
    }
  `,
  dataTable: css`
    font-size: ${theme.typography.size.md};
    margin-bottom: ${theme.spacing.md};
    background: ${theme.colors.panelBg};
    color: ${theme.colors.textSemiWeak};
    width: 100%;
    td,
    th {
      padding: ${theme.spacing.sm};
    }
    tbody > tr:nth-child(odd) {
      background: ${theme.colors.panelBorder};
    }
  `,
});
