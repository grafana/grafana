import { groupOTelAttributes } from './details';

describe('groupOTelAttributes', () => {
  const getKey = (item: { key: string }) => item.key;

  it('returns an empty list when there are no attributes', () => {
    expect(groupOTelAttributes([], getKey)).toEqual([]);
  });

  it('groups attributes by semantic namespace and sends unmatched keys to other', () => {
    const attributes = [
      { key: 'service.name', value: 'api' },
      { key: 'service.version', value: '1.0.0' },
      { key: 'k8s.namespace.name', value: 'default' },
      { key: 'k8s.pod.name', value: 'api-123' },
      { key: 'telemetry.sdk.language', value: 'go' },
      { key: 'custom.field', value: 'value' },
    ];

    const grouped = groupOTelAttributes(attributes, getKey);

    expect(grouped.map(({ category }) => category.id)).toEqual(['service', 'kubernetes', 'telemetry-sdk', 'other']);
    expect(grouped[0].items).toEqual([
      { key: 'service.name', value: 'api' },
      { key: 'service.version', value: '1.0.0' },
    ]);
    expect(grouped[1].items).toEqual([
      { key: 'k8s.namespace.name', value: 'default' },
      { key: 'k8s.pod.name', value: 'api-123' },
    ]);
    expect(grouped[2].items).toEqual([{ key: 'telemetry.sdk.language', value: 'go' }]);
    expect(grouped[3].items).toEqual([{ key: 'custom.field', value: 'value' }]);
  });

  it('matches underscore-prefixed attribute keys', () => {
    const grouped = groupOTelAttributes(
      [
        { key: 'service_name', value: 'api' },
        { key: 'k8s_pod_name', value: 'api-123' },
        { key: 'http_method', value: 'POST' },
      ],
      getKey
    );

    expect(grouped.map(({ category }) => category.id)).toEqual(['service', 'kubernetes', 'http']);
  });

  it('groups cloud provider attributes together', () => {
    const grouped = groupOTelAttributes(
      [
        { key: 'aws.region', value: 'us-east-1' },
        { key: 'gcp.project.id', value: 'project-1' },
        { key: 'azure.resource.group', value: 'rg-1' },
        { key: 'cloud.provider', value: 'aws' },
      ],
      getKey
    );

    expect(grouped).toHaveLength(1);
    expect(grouped[0].category.id).toBe('cloud');
    expect(grouped[0].items).toHaveLength(4);
  });

  it('groups google cloud attributes under Cloud, not Runtime', () => {
    const grouped = groupOTelAttributes(
      [
        { key: 'google.cloud.project', value: 'my-project' },
        { key: 'go.memory.used', value: '256' },
      ],
      getKey
    );

    expect(grouped.map(({ category }) => category.id)).toEqual(['runtime', 'cloud']);
    expect(grouped[0].items).toEqual([{ key: 'go.memory.used', value: '256' }]);
    expect(grouped[1].items).toEqual([{ key: 'google.cloud.project', value: 'my-project' }]);
  });

  it('orders categories by resource gravity, then remaining labels, with other last', () => {
    const grouped = groupOTelAttributes(
      [
        { key: 'custom.field', value: 'value' },
        { key: 'http.method', value: 'GET' },
        { key: 'telemetry.sdk.language', value: 'go' },
        { key: 'error.type', value: 'timeout' },
        { key: 'service.name', value: 'api' },
        { key: 'browser.name', value: 'Chrome' },
        { key: 'exception.message', value: 'failed' },
      ],
      getKey
    );

    expect(grouped.map(({ category }) => category.id)).toEqual([
      'frontend',
      'service',
      'telemetry-sdk',
      'error',
      'exception',
      'http',
      'other',
    ]);
  });

  it('does not treat a bare prefix as a match', () => {
    const grouped = groupOTelAttributes(
      [
        { key: 'service', value: 'api' },
        { key: 'httpx.method', value: 'GET' },
      ],
      getKey
    );

    expect(grouped.map(({ category }) => category.id)).toEqual(['other']);
    expect(grouped[0].items).toHaveLength(2);
  });

  it('reads FieldDef keys through the provided accessor', () => {
    const grouped = groupOTelAttributes(
      [
        { keys: ['db.system'], values: ['postgres'] },
        { keys: ['db.statement'], values: ['SELECT 1'] },
      ],
      (field) => field.keys[0] ?? ''
    );

    expect(grouped.map(({ category }) => category.id)).toEqual(['database']);
    expect(grouped[0].items).toHaveLength(2);
  });
});
