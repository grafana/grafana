import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { type Resource } from 'app/features/apiserver/types';

import { buildNotebookEnvelope } from './buildNotebookEnvelope';

function notebookResource(): Resource<NotebookSpec> {
  return {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'Notebook',
    metadata: {
      name: 'nb-1',
      resourceVersion: '7',
      creationTimestamp: '2026-07-01T00:00:00Z',
    },
    spec: { ...defaultNotebookSpec(), title: 'My notebook' },
  };
}

describe('buildNotebookEnvelope', () => {
  it('wraps a notebook resource in a DashboardWithAccessInfo envelope', () => {
    const notebook = notebookResource();

    const envelope = buildNotebookEnvelope(notebook);

    expect(envelope.kind).toBe('DashboardWithAccessInfo');
    expect(envelope.apiVersion).toBe(notebook.apiVersion);
    expect(envelope.metadata).toBe(notebook.metadata);
    // spec is carried through unchanged (the transformer reads it by shape at runtime).
    expect(envelope.spec).toBe(notebook.spec);
  });

  it('provides an access block so the transformer can read permissions', () => {
    const envelope = buildNotebookEnvelope(notebookResource());

    expect(envelope.access).toEqual({
      canSave: true,
      canEdit: true,
      canDelete: true,
      canShare: true,
      canStar: true,
    });
  });
});
