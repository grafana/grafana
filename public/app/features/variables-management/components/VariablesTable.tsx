import { css, cx } from '@emotion/css';
import { Fragment } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Checkbox, Icon, useStyles2 } from '@grafana/ui';
import { type Variable } from 'app/api/clients/dashboard/v2beta1';
import { getVariableTypeLabel } from 'app/features/dashboard-scene/settings/variables/utils';

import {
  getVariableEditableType,
  getVariableSpecName,
  type VariablesTreeFolder,
  type VariablesTreeModel,
} from '../utils';

export interface VariablesTableProps {
  tree: VariablesTreeModel;
  expandedFolders: Set<string>;
  onToggleFolder: (folderUid: string) => void;
  selected: Set<string>;
  onSetSelected: (names: string[], isSelected: boolean) => void;
  onEdit: (variable: Variable) => void;
}

export function VariablesTable({
  tree,
  expandedFolders,
  onToggleFolder,
  selected,
  onSetSelected,
  onEdit,
}: VariablesTableProps) {
  const styles = useStyles2(getStyles);

  const allNames = [
    ...tree.folders.flatMap((folder) => folder.variables.map((v) => v.metadata.name ?? '')),
    ...tree.global.map((v) => v.metadata.name ?? ''),
  ].filter(Boolean);
  const allSelected = allNames.length > 0 && allNames.every((name) => selected.has(name));
  const someSelected = allNames.some((name) => selected.has(name));

  return (
    <table className={styles.table} role="grid">
      <thead>
        <tr>
          <th className={styles.checkboxCell}>
            <Checkbox
              value={allSelected}
              indeterminate={someSelected && !allSelected}
              aria-label={t('variables-management.table.select-all', 'Select all variables')}
              onChange={() => onSetSelected(allNames, !allSelected)}
            />
          </th>
          <th>
            <Trans i18nKey="variables-management.table.header-name">Name</Trans>
          </th>
          <th>
            <Trans i18nKey="variables-management.table.header-type">Type</Trans>
          </th>
        </tr>
      </thead>
      <tbody>
        {tree.folders.map((folder) => (
          <FolderRows
            key={folder.uid}
            folder={folder}
            isExpanded={expandedFolders.has(folder.uid)}
            onToggleFolder={onToggleFolder}
            selected={selected}
            onSetSelected={onSetSelected}
            onEdit={onEdit}
          />
        ))}
        {tree.global.map((variable) => (
          <VariableRow
            key={variable.metadata.name}
            variable={variable}
            indented={false}
            selected={selected}
            onSetSelected={onSetSelected}
            onEdit={onEdit}
          />
        ))}
      </tbody>
    </table>
  );
}

interface FolderRowsProps {
  folder: VariablesTreeFolder;
  isExpanded: boolean;
  onToggleFolder: (folderUid: string) => void;
  selected: Set<string>;
  onSetSelected: (names: string[], isSelected: boolean) => void;
  onEdit: (variable: Variable) => void;
}

function FolderRows({ folder, isExpanded, onToggleFolder, selected, onSetSelected, onEdit }: FolderRowsProps) {
  const styles = useStyles2(getStyles);
  const names = folder.variables.map((v) => v.metadata.name ?? '').filter(Boolean);
  const allSelected = names.length > 0 && names.every((name) => selected.has(name));
  const someSelected = names.some((name) => selected.has(name));

  return (
    <Fragment>
      <tr>
        <td className={styles.checkboxCell}>
          <Checkbox
            value={allSelected}
            indeterminate={someSelected && !allSelected}
            aria-label={t('variables-management.table.select-folder', 'Select all variables in folder {{title}}', {
              title: folder.title,
            })}
            onChange={() => onSetSelected(names, !allSelected)}
          />
        </td>
        <td colSpan={2}>
          <button
            type="button"
            className={styles.folderButton}
            onClick={() => onToggleFolder(folder.uid)}
            aria-expanded={isExpanded}
          >
            <Icon name={isExpanded ? 'angle-down' : 'angle-right'} />
            <Icon name="folder" />
            <span>{folder.title}</span>
            <span className={styles.count}>({folder.variables.length})</span>
          </button>
        </td>
      </tr>
      {isExpanded &&
        folder.variables.map((variable) => (
          <VariableRow
            key={variable.metadata.name}
            variable={variable}
            indented
            selected={selected}
            onSetSelected={onSetSelected}
            onEdit={onEdit}
          />
        ))}
    </Fragment>
  );
}

interface VariableRowProps {
  variable: Variable;
  indented: boolean;
  selected: Set<string>;
  onSetSelected: (names: string[], isSelected: boolean) => void;
  onEdit: (variable: Variable) => void;
}

function VariableRow({ variable, indented, selected, onSetSelected, onEdit }: VariableRowProps) {
  const styles = useStyles2(getStyles);
  const metadataName = variable.metadata.name ?? '';
  const specName = getVariableSpecName(variable);
  // Standalone so the type column matches the editor's type selector labels
  // (e.g. adhoc as "Filter and Group by" under unified drilldown controls).
  const typeLabel = getVariableTypeLabel(getVariableEditableType(variable), { standalone: true });

  return (
    <tr>
      <td className={styles.checkboxCell}>
        <Checkbox
          value={selected.has(metadataName)}
          aria-label={t('variables-management.table.select-variable', 'Select variable {{name}}', { name: specName })}
          onChange={() => onSetSelected([metadataName], !selected.has(metadataName))}
        />
      </td>
      <td>
        <button
          type="button"
          className={cx(styles.nameButton, indented && styles.indented)}
          onClick={() => onEdit(variable)}
        >
          <Icon name="brackets-curly" />
          <span>{specName}</span>
        </button>
      </td>
      <td>{typeLabel}</td>
    </tr>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
    borderCollapse: 'collapse',

    'th, td': {
      padding: theme.spacing(1),
      textAlign: 'left',
    },

    th: {
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },

    'tbody tr:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  checkboxCell: css({
    width: theme.spacing(4),
  }),
  folderButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    background: 'none',
    border: 'none',
    padding: 0,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    fontWeight: theme.typography.fontWeightMedium,
  }),
  count: css({
    color: theme.colors.text.secondary,
  }),
  nameButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    background: 'none',
    border: 'none',
    padding: 0,
    // Offset by one icon width + gap so the title lines up with folder titles,
    // which are preceded by the expand chevron.
    marginLeft: theme.spacing(3),
    color: theme.colors.text.primary,
    cursor: 'pointer',

    '&:hover': {
      textDecoration: 'underline',
    },
  }),
  indented: css({
    marginLeft: theme.spacing(6),
  }),
});
