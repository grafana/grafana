import { makeDeletedRule } from '../mocks/handlers';

import { sanitizeForRestore } from './useRestoreRule';

describe('sanitizeForRestore', () => {
  it('removes deletionTimestamp, resourceVersion and generation', () => {
    const result = sanitizeForRestore(makeDeletedRule());

    expect(result.metadata.deletionTimestamp).toBeUndefined();
    expect(result.metadata.resourceVersion).toBeUndefined();
    expect(result.metadata.generation).toBeUndefined();
  });

  it('keeps annotations as-is (provenance and ownership left for the backend to handle)', () => {
    const rule = makeDeletedRule();
    rule.metadata.annotations = {
      'grafana.app/folder': 'folder-uid',
      'grafana.com/provenance': 'api',
      'grafana.app/managedBy': 'terraform',
    };

    const result = sanitizeForRestore(rule);

    expect(result.metadata.annotations?.['grafana.app/folder']).toBe('folder-uid');
    expect(result.metadata.annotations?.['grafana.com/provenance']).toBe('api');
    expect(result.metadata.annotations?.['grafana.app/managedBy']).toBe('terraform');
  });

  it('strips grafana.com/group labels that the group-free create API rejects', () => {
    const rule = makeDeletedRule();
    rule.metadata.labels = {
      'grafana.app/folder': 'folder-uid',
      'grafana.com/group': 'g1',
      'grafana.com/group-index': '0',
    };

    const result = sanitizeForRestore(rule);

    expect(result.metadata.labels?.['grafana.app/folder']).toBe('folder-uid');
    expect(result.metadata.labels?.['grafana.com/group']).toBeUndefined();
    expect(result.metadata.labels?.['grafana.com/group-index']).toBeUndefined();
  });

  it('keeps metadata.name for UID preservation', () => {
    const rule = makeDeletedRule();
    rule.metadata.name = 'my-rule-uid';
    const result = sanitizeForRestore(rule);
    expect(result.metadata.name).toBe('my-rule-uid');
  });
});
