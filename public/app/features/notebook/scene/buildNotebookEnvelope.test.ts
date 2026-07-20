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
    // The notebook's own fields are carried onto the spec.
    expect(envelope.spec.title).toBe('My notebook');
    expect(envelope.spec.elements).toBe(notebook.spec.elements);
    expect(envelope.spec.layout).toBe(notebook.spec.layout);
  });

  it("defaults description to '' when the notebook has none", () => {
    const notebook = notebookResource();
    delete notebook.spec.description;

    const envelope = buildNotebookEnvelope(notebook);

    // description is required on the dashboard spec, so an absent notebook description must not
    // leave it undefined.
    expect(envelope.spec.description).toBe('');
  });

  it('fills dashboard-only fields the transformer reads directly', () => {
    const envelope = buildNotebookEnvelope(notebookResource());

    // NotebookSpec omits these; without defaults the transformer crashes (e.g. spreading links).
    expect(Array.isArray(envelope.spec.links)).toBe(true);
    expect(Array.isArray(envelope.spec.annotations)).toBe(true);
    expect(Array.isArray(envelope.spec.variables)).toBe(true);
    expect(envelope.spec.cursorSync).toBeDefined();
  });

  it('denies every permission because the notebook view is read-only', () => {
    const envelope = buildNotebookEnvelope(notebookResource());

    expect(envelope.access).toEqual({
      canSave: false,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canStar: false,
    });
  });
});
