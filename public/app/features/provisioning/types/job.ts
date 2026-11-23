import { type KindInfo } from '@grafana/runtime/unstable';
import { type JobResourceRef as GeneratedResourceRef } from 'app/api/clients/provisioning/v0alpha1';

// Reuse the generated ResourceRef but require every field: a delete/move job needs a
// fully-specified ref, whereas the generated fields are all optional.
export type ResourceRef = Required<GeneratedResourceRef>;

// Pass the group that serves the resource. No API serves a collection kind's registry group.
export function toResourceRef(kind: Pick<KindInfo, 'group' | 'kind'>, name: string): ResourceRef {
  return { name, group: kind.group, kind: kind.kind };
}

// Jobs name their targets as resource refs rather than file paths: the backend authorizes a ref
// against the named resource, so a grant on that one dashboard suffices, whereas a path is only
// checked against its folder.
export interface DeleteJobSpec {
  action: 'delete';
  message?: string;
  delete: {
    ref?: string;
    resources: ResourceRef[];
  };
}

export interface MoveJobSpec {
  action: 'move';
  message?: string;
  move: {
    ref?: string;
    targetPath: string; // Must end with '/' slash
    resources: ResourceRef[];
  };
}

export type ResourceJobSpec = DeleteJobSpec | MoveJobSpec;
