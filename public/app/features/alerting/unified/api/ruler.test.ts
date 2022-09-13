import { RulerDataSourceConfig } from 'app/types/unified-alerting';

import { getDatasourceAPIUid } from '../utils/datasource';

import { rulerUrlBuilder } from './ruler';

jest.mock('../utils/datasource');

const mocks = {
  getDatasourceAPIUId: jest.mocked(getDatasourceAPIUid),
};

describe('rulerUrlBuilder', () => {
  it('Should use /api/v1/rules endpoint with subtype = cortex param for legacy api version', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex',
      apiVersion: 'legacy',
    };

    mocks.getDatasourceAPIUId.mockReturnValue('ds-uid');

    // Act
    const builder = rulerUrlBuilder(config);

    const rules = builder.rules();
    const namespace = builder.namespace('test-ns');
    const group = builder.namespaceGroup('test-ns', 'test-gr');

    // Assert
    expect(rules.path).toBe('/api/ruler/ds-uid/api/v1/rules');
    expect(rules.params).toMatchObject({ subtype: 'cortex' });

    expect(namespace.path).toBe('/api/ruler/ds-uid/api/v1/rules/test-ns');
    expect(namespace.params).toMatchObject({ subtype: 'cortex' });

    expect(group.path).toBe('/api/ruler/ds-uid/api/v1/rules/test-ns/test-gr');
    expect(group.params).toMatchObject({ subtype: 'cortex' });
  });

  it('Should use /api/v1/rules endpoint with subtype = mimir parameter for config api version', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex v2',
      apiVersion: 'config',
    };

    mocks.getDatasourceAPIUId.mockReturnValue('ds-uid');

    // Act
    const builder = rulerUrlBuilder(config);

    const rules = builder.rules();
    const namespace = builder.namespace('test-ns');
    const group = builder.namespaceGroup('test-ns', 'test-gr');

    // Assert
    expect(rules.path).toBe('/api/ruler/ds-uid/api/v1/rules');
    expect(rules.params).toMatchObject({ subtype: 'mimir' });

    expect(namespace.path).toBe('/api/ruler/ds-uid/api/v1/rules/test-ns');
    expect(namespace.params).toMatchObject({ subtype: 'mimir' });

    expect(group.path).toBe('/api/ruler/ds-uid/api/v1/rules/test-ns/test-gr');
    expect(group.params).toMatchObject({ subtype: 'mimir' });
  });

  it('Should append source=rules parameter when custom ruler enabled', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex v2',
      apiVersion: 'config',
    };

    mocks.getDatasourceAPIUId.mockReturnValue('ds-uid');

    // Act
    const builder = rulerUrlBuilder(config);

    const rules = builder.rules();
    const namespace = builder.namespace('test-ns');
    const group = builder.namespaceGroup('test-ns', 'test-gr');

    // Assert
    expect(rules.params).toMatchObject({ subtype: 'mimir' });
    expect(namespace.params).toMatchObject({ subtype: 'mimir' });
    expect(group.params).toMatchObject({ subtype: 'mimir' });
  });

  it('Should append dashboard_uid and panel_id for rules endpoint when specified', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex v2',
      apiVersion: 'config',
    };

    mocks.getDatasourceAPIUId.mockReturnValue('ds-uid');

    // Act
    const builder = rulerUrlBuilder(config);
    const rules = builder.rules({ dashboardUID: 'dashboard-uid', panelId: 1234 });

    // Assert
    expect(rules.params).toMatchObject({ dashboard_uid: 'dashboard-uid', panel_id: '1234', subtype: 'mimir' });
  });
});
