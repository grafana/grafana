import { RulerDataSourceConfig } from 'app/types/unified-alerting';

import { mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';
import { DataSourceType } from '../utils/datasource';

import { GRAFANA_RULER_CONFIG } from './featureDiscoveryApi';
import { rulerUrlBuilder } from './ruler';

const mimirConfig: RulerDataSourceConfig = {
  dataSourceName: 'Mimir-cloud',
  dataSourceUid: 'mimir-1',
  apiVersion: 'config',
};

beforeAll(() => {
  setupDataSources(
    mockDataSource({ type: DataSourceType.Prometheus, name: 'Mimir-cloud', uid: 'mimir-1' }),
    mockDataSource({ type: DataSourceType.Prometheus, name: 'Cortex', uid: 'cortex-1' })
  );
});

describe('rulerUrlBuilder', () => {
  it('Should use /api/v1/rules endpoint with subtype = cortex param for legacy api version', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex',
      dataSourceUid: 'cortex-1',
      apiVersion: 'legacy',
    };

    // Act
    const builder = rulerUrlBuilder(config);

    const rules = builder.rules();
    const namespace = builder.namespace('test-ns');
    const group = builder.namespaceGroup('test-ns', 'test-gr');

    // Assert
    expect(rules.path).toBe('/api/ruler/cortex-1/api/v1/rules');
    expect(rules.params).toMatchObject({ subtype: 'cortex' });

    expect(namespace.path).toBe('/api/ruler/cortex-1/api/v1/rules/test-ns');
    expect(namespace.params).toMatchObject({ subtype: 'cortex' });

    expect(group.path).toBe('/api/ruler/cortex-1/api/v1/rules/test-ns/test-gr');
    expect(group.params).toMatchObject({ subtype: 'cortex' });
  });

  it('Should use /api/v1/rules endpoint with subtype = mimir parameter for config api version', () => {
    // Act
    const builder = rulerUrlBuilder(mimirConfig);

    const rules = builder.rules();
    const namespace = builder.namespace('test-ns');
    const group = builder.namespaceGroup('test-ns', 'test-gr');

    // Assert
    expect(rules.path).toBe('/api/ruler/mimir-1/api/v1/rules');
    expect(rules.params).toMatchObject({ subtype: 'mimir' });

    expect(namespace.path).toBe('/api/ruler/mimir-1/api/v1/rules/test-ns');
    expect(namespace.params).toMatchObject({ subtype: 'mimir' });

    expect(group.path).toBe('/api/ruler/mimir-1/api/v1/rules/test-ns/test-gr');
    expect(group.params).toMatchObject({ subtype: 'mimir' });
  });

  it('Should append subtype parameter when custom ruler enabled', () => {
    // Act
    const builder = rulerUrlBuilder(mimirConfig);

    const rules = builder.rules();
    const namespace = builder.namespace('test-ns');
    const group = builder.namespaceGroup('test-ns', 'test-gr');

    // Assert
    expect(rules.params).toMatchObject({ subtype: 'mimir' });
    expect(namespace.params).toMatchObject({ subtype: 'mimir' });
    expect(group.params).toMatchObject({ subtype: 'mimir' });
  });

  it('Should append dashboard_uid and panel_id for rules endpoint when specified', () => {
    // Act
    const builder = rulerUrlBuilder(mimirConfig);
    const rules = builder.rules({ dashboardUID: 'dashboard-uid', panelId: 1234 });

    // Assert
    expect(rules.params).toMatchObject({ dashboard_uid: 'dashboard-uid', panel_id: '1234', subtype: 'mimir' });
  });

  describe('When slash in namespace or group', () => {
    it('Should use QUERY_NAMESPACE and QUERY_GROUP path placeholders and include names in query string params', () => {
      // Act
      const builder = rulerUrlBuilder(mimirConfig);

      const namespace = builder.namespace('test/ns');
      const group = builder.namespaceGroup('test/ns', 'test/gr');

      // Assert
      expect(namespace.path).toBe('/api/ruler/mimir-1/api/v1/rules/QUERY_NAMESPACE');
      expect(namespace.params).toMatchObject({ subtype: 'mimir', namespace: 'test/ns' });

      expect(group.path).toBe('/api/ruler/mimir-1/api/v1/rules/QUERY_NAMESPACE/QUERY_GROUP');
      expect(group.params).toMatchObject({ subtype: 'mimir', namespace: 'test/ns', group: 'test/gr' });
    });

    it('Should use the tag replacement only when the slash is present', () => {
      // Act
      const builder = rulerUrlBuilder(mimirConfig);

      const group = builder.namespaceGroup('test-ns', 'test/gr');

      // Assert
      expect(group.path).toBe('/api/ruler/mimir-1/api/v1/rules/test-ns/QUERY_GROUP');
      expect(group.params).toMatchObject({ subtype: 'mimir', group: 'test/gr' });
    });

    // GMA uses folderUIDs as namespaces and they should never contain slashes
    it('Should only replace the group segment for Grafana-managed rules', () => {
      // Act
      const builder = rulerUrlBuilder(GRAFANA_RULER_CONFIG);

      const group = builder.namespaceGroup('test/ns', 'test/gr');

      // Assert
      expect(group.path).toBe(`/api/ruler/grafana/api/v1/rules/${encodeURIComponent('test/ns')}/QUERY_GROUP`);
      expect(group.params).toHaveProperty('group');
      expect(group.params).not.toHaveProperty('namespace');
    });
  });
});
