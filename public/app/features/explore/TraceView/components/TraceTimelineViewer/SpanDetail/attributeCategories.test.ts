import { groupAttributesByCategory, SERVICE_CATEGORY_ID } from './attributeCategories';

describe('groupAttributesByCategory', () => {
  it('groups resource attributes by semantic namespace', () => {
    const attributes = [
      { key: 'service.name', value: 'api' },
      { key: 'service.version', value: '1.0.0' },
      { key: 'k8s.namespace.name', value: 'default' },
      { key: 'k8s.pod.name', value: 'api-123' },
      { key: 'telemetry.sdk.language', value: 'go' },
      { key: 'custom.field', value: 'value' },
    ];

    const grouped = groupAttributesByCategory(attributes, 'resource');

    expect(grouped.map(({ category }) => category.id)).toEqual([
      SERVICE_CATEGORY_ID,
      'kubernetes',
      'telemetry-sdk',
      'other',
    ]);
    expect(grouped[0].attributes).toHaveLength(2);
    expect(grouped[1].attributes).toHaveLength(2);
    expect(grouped[2].attributes).toHaveLength(1);
    expect(grouped[3].attributes).toEqual([{ key: 'custom.field', value: 'value' }]);
  });

  it('groups span attributes by semantic namespace', () => {
    const attributes = [
      { key: 'http.method', value: 'GET' },
      { key: 'http.status_code', value: '200' },
      { key: 'url.full', value: 'http://example.com' },
      { key: 'db.system', value: 'postgres' },
      { key: 'messaging.system', value: 'kafka' },
      { key: 'rpc.system', value: 'grpc' },
      { key: 'client.address', value: '127.0.0.1' },
    ];

    const grouped = groupAttributesByCategory(attributes, 'span');

    expect(grouped.map(({ category }) => category.id)).toEqual([
      'http',
      'url',
      'database',
      'messaging',
      'network',
      'rpc',
    ]);
  });

  it('matches underscore-prefixed attribute keys', () => {
    const resourceGrouped = groupAttributesByCategory(
      [
        { key: 'service_name', value: 'api' },
        { key: 'k8s_pod_name', value: 'api-123' },
      ],
      'resource'
    );
    const spanGrouped = groupAttributesByCategory([{ key: 'http_method', value: 'POST' }], 'span');

    expect(resourceGrouped.map(({ category }) => category.id)).toEqual([SERVICE_CATEGORY_ID, 'kubernetes']);
    expect(spanGrouped.map(({ category }) => category.id)).toEqual(['http']);
  });

  it('groups cloud provider attributes together', () => {
    const attributes = [
      { key: 'aws.region', value: 'us-east-1' },
      { key: 'gcp.project.id', value: 'project-1' },
      { key: 'azure.resource.group', value: 'rg-1' },
      { key: 'cloud.provider', value: 'aws' },
    ];

    const grouped = groupAttributesByCategory(attributes, 'resource');

    expect(grouped).toHaveLength(1);
    expect(grouped[0].category.id).toBe('cloud');
    expect(grouped[0].attributes).toHaveLength(4);
  });

  it('groups frontend span attributes such as session.id', () => {
    const attributes = [
      { key: 'session.id', value: 'abc123' },
      { key: 'browser.name', value: 'Chrome' },
    ];

    const grouped = groupAttributesByCategory(attributes, 'span');

    expect(grouped).toHaveLength(1);
    expect(grouped[0].category.id).toBe('frontend');
    expect(grouped[0].attributes).toHaveLength(2);
  });

  it('groups gf.feo11y resource attributes under Frontend', () => {
    const attributes = [
      { key: 'gf.feo11y.app.id', value: '42' },
      { key: 'gf.feo11y.app.name', value: 'my-app' },
      { key: 'gf.feo11y.app.original_name', value: 'my-original-app' },
    ];

    const grouped = groupAttributesByCategory(attributes, 'resource');

    expect(grouped).toHaveLength(1);
    expect(grouped[0].category.id).toBe('frontend');
    expect(grouped[0].attributes).toHaveLength(3);
  });

  it('groups host, system, and os attributes under Host / OS', () => {
    const attributes = [
      { key: 'host.name', value: 'node-1' },
      { key: 'system.cpu.utilization', value: '0.42' },
      { key: 'system.memory.usage', value: '1024' },
      { key: 'os.type', value: 'linux' },
    ];

    const grouped = groupAttributesByCategory(attributes, 'resource');

    expect(grouped).toHaveLength(1);
    expect(grouped[0].category.id).toBe('host-os');
    expect(grouped[0].attributes).toHaveLength(4);
  });

  it('groups runtime-specific attributes', () => {
    const attributes = [
      { key: 'jvm.memory.used', value: '512' },
      { key: 'nodejs.eventloop.delay', value: '12' },
      { key: 'go.memory.used', value: '256' },
      { key: 'dotnet.gc.collections', value: '3' },
    ];

    const grouped = groupAttributesByCategory(attributes, 'span');

    expect(grouped).toHaveLength(1);
    expect(grouped[0].category.id).toBe('runtime');
    expect(grouped[0].attributes).toHaveLength(4);
  });

  it('groups deployment, error, and exception attributes in both sections', () => {
    const resourceGrouped = groupAttributesByCategory(
      [{ key: 'deployment.environment', value: 'production' }],
      'resource'
    );
    const spanGrouped = groupAttributesByCategory(
      [
        { key: 'error.type', value: 'timeout' },
        { key: 'exception.message', value: 'Something failed' },
        { key: 'exception.stacktrace', value: 'at main' },
      ],
      'span'
    );

    expect(resourceGrouped.map(({ category }) => category.id)).toEqual(['deployment']);
    expect(spanGrouped.map(({ category }) => category.id)).toEqual(['error', 'exception']);
  });

  it('groups span-only prefixes in resource attributes', () => {
    const grouped = groupAttributesByCategory(
      [
        { key: 'http.method', value: 'GET' },
        { key: 'exception.message', value: 'failed' },
      ],
      'resource'
    );

    expect(grouped.map(({ category }) => category.id)).toEqual(['exception', 'http']);
  });

  it('groups resource-only prefixes in span attributes', () => {
    const grouped = groupAttributesByCategory(
      [
        { key: 'service.name', value: 'api' },
        { key: 'k8s.pod.name', value: 'pod-1' },
      ],
      'span'
    );

    expect(grouped.map(({ category }) => category.id)).toEqual(['kubernetes', SERVICE_CATEGORY_ID]);
  });

  it('orders service first and alphabetizes remaining resource categories', () => {
    const attributes = [
      { key: 'telemetry.sdk.language', value: 'go' },
      { key: 'k8s.namespace.name', value: 'default' },
      { key: 'service.name', value: 'api' },
      { key: 'cloud.provider', value: 'aws' },
    ];

    const grouped = groupAttributesByCategory(attributes, 'resource');

    expect(grouped.map(({ category }) => category.id)).toEqual([
      SERVICE_CATEGORY_ID,
      'cloud',
      'kubernetes',
      'telemetry-sdk',
    ]);
  });

  it('groups google cloud attributes under Cloud, not Runtime', () => {
    const grouped = groupAttributesByCategory(
      [
        { key: 'google.cloud.project', value: 'my-project' },
        { key: 'go.memory.used', value: '256' },
      ],
      'span'
    );

    expect(grouped.map(({ category }) => category.id)).toEqual(['cloud', 'runtime']);
    expect(grouped[0].attributes).toEqual([{ key: 'google.cloud.project', value: 'my-project' }]);
    expect(grouped[1].attributes).toEqual([{ key: 'go.memory.used', value: '256' }]);
  });

  it('returns an empty list when there are no attributes', () => {
    expect(groupAttributesByCategory([], 'span')).toEqual([]);
  });
});
