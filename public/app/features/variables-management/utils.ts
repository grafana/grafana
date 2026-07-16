import { config } from '@grafana/runtime';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Variable, type VariableSpec } from 'app/api/clients/dashboard/v2beta1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { type EditableVariableType } from 'app/features/dashboard-scene/settings/variables/utils';

/** Folder UIDs that appear in NestedFolderPicker but are not valid variable scopes. */
export function getVariableFolderPickerExcludeUIDs(): string[] | undefined {
  return config.sharedWithMeFolderUID ? [config.sharedWithMeFolderUID] : undefined;
}

const KIND_TO_EDITABLE_TYPE: Record<VariableKind['kind'], EditableVariableType> = {
  QueryVariable: 'query',
  TextVariable: 'textbox',
  ConstantVariable: 'constant',
  DatasourceVariable: 'datasource',
  IntervalVariable: 'interval',
  CustomVariable: 'custom',
  GroupByVariable: 'groupby',
  AdhocVariable: 'adhoc',
  SwitchVariable: 'switch',
};

/**
 * The generated `VariableSpec` type represents the OpenAPI encoding of the variable
 * union (a struct of optional per-kind fields), but the wire format produced by the
 * backend is the discriminated `VariableKind` union (`{ kind, spec }`) — see the
 * custom MarshalJSON on `VariableSpec` in apps/dashboard. The v2 and v2beta1
 * variable schemas are wire-compatible, so we treat the spec as the v2 stable
 * `VariableKind` used by the scene serializers.
 */
export function getVariableKind(variable: Variable): VariableKind {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return variable.spec as unknown as VariableKind;
}

export function toWireVariableSpec(kind: VariableKind): VariableSpec {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return kind as unknown as VariableSpec;
}

/** The logical variable name (spec.spec.name), as opposed to the resource metadata.name. */
export function getVariableSpecName(variable: Variable): string {
  return getVariableKind(variable).spec.name;
}

/**
 * Server-derived Variable metadata.name — mirrors deriveVariableMetadataName in
 * pkg/registry/apis/dashboard/variable.go:
 *   global → specName
 *   folder → specName + "--" + folderUID
 */
export function deriveVariableMetadataName(specName: string, folderUid?: string): string {
  if (!folderUid) {
    return specName;
  }
  return `${specName}--${folderUid}`;
}

/**
 * Next unused name with the given prefix among existing logical variable names
 * (e.g. query0, query1, …) — same scheme as dashboard settings' getNextAvailableId.
 */
export function getNextAvailableVariableName(prefix: string, existingNames: string[]): string {
  let counter = 0;
  let nextId = `${prefix}${counter}`;
  const taken = new Set(existingNames);
  while (taken.has(nextId)) {
    nextId = `${prefix}${++counter}`;
  }
  return nextId;
}

/** Folder UID from the folder annotation; undefined means the variable is global (org-wide). */
export function getVariableFolderUid(variable: Variable): string | undefined {
  return variable.metadata.annotations?.[AnnoKeyFolder] || undefined;
}

export function getVariableEditableType(variable: Variable): EditableVariableType {
  return KIND_TO_EDITABLE_TYPE[getVariableKind(variable).kind];
}

/**
 * Builds a Variable resource for a CREATE request. metadata.name is intentionally
 * omitted — the server derives it from spec.spec.name and the folder annotation.
 */
export function buildVariableResource(kind: VariableKind, folderUid?: string): Variable {
  return {
    metadata: folderUid ? { annotations: { [AnnoKeyFolder]: folderUid } } : {},
    spec: toWireVariableSpec(kind),
  };
}

export interface VariablesTreeFolder {
  uid: string;
  title: string;
  variables: Variable[];
}

export interface VariablesTreeModel {
  folders: VariablesTreeFolder[];
  /** Variables without a folder scope (global / org-wide). */
  global: Variable[];
}

export function buildVariablesTree(variables: Variable[], folderTitles: Record<string, string>): VariablesTreeModel {
  const byFolder = new Map<string, Variable[]>();
  const global: Variable[] = [];

  for (const variable of variables) {
    const folderUid = getVariableFolderUid(variable);
    if (!folderUid) {
      global.push(variable);
      continue;
    }
    const group = byFolder.get(folderUid);
    if (group) {
      group.push(variable);
    } else {
      byFolder.set(folderUid, [variable]);
    }
  }

  const collator = new Intl.Collator();
  const byName = (a: Variable, b: Variable) => collator.compare(getVariableSpecName(a), getVariableSpecName(b));

  const folders = [...byFolder.entries()]
    .map(([uid, folderVariables]) => ({
      uid,
      title: folderTitles[uid] ?? uid,
      variables: folderVariables.sort(byName),
    }))
    .sort((a, b) => collator.compare(a.title, b.title));

  global.sort(byName);

  return { folders, global };
}
