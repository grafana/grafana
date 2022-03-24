import { RulerDataSourceConfig } from 'app/types/unified-alerting';
import { getDatasourceAPIId } from '../utils/datasource';
import { rulerUrlBuilder } from './ruler';

jest.mock('../utils/datasource');

const mocks = {
  getDatasourceAPIId: jest.mocked(getDatasourceAPIId),
};

describe('rulerUrlBuilder', () => {
  it('Should use /api/v1/rules endpoint with subtype = 2 param for legacy api version', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex',
      apiVersion: 'legacy',
    };

    mocks.getDatasourceAPIId.mockReturnValue('ds-uid');

    // Act
    const builder = rulerUrlBuilder(config);

    const rules = builder.rules();
    const namespace = builder.namespace('test-ns');
    const group = builder.namespaceGroup('test-ns', 'test-gr');

    // Assert
    expect(rules.path).toBe('/api/ruler/ds-uid/api/v1/rules');
    expect(rules.params).toMatchObject({ subtype: '2' });

    expect(namespace.path).toBe('/api/ruler/ds-uid/api/v1/rules/test-ns');
    expect(namespace.params).toMatchObject({ subtype: '2' });

    expect(group.path).toBe('/api/ruler/ds-uid/api/v1/rules/test-ns/test-gr');
    expect(group.params).toMatchObject({ subtype: '2' });
  });

  it('Should use /api/v1/rules endpoint with subtype = 3 parameter for config api version', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex v2',
      apiVersion: 'config',
    };

    mocks.getDatasourceAPIId.mockReturnValue('ds-uid');

    // Act
    const builder = rulerUrlBuilder(config);

    const rules = builder.rules();
    const namespace = builder.namespace('test-ns');
    const group = builder.namespaceGroup('test-ns', 'test-gr');

    // Assert
    expect(rules.path).toBe('/api/ruler/ds-uid/api/v1/rules');
    expect(rules.params).toMatchObject({ subtype: '3' });

    expect(namespace.path).toBe('/api/ruler/ds-uid/api/v1/rules/test-ns');
    expect(namespace.params).toMatchObject({ subtype: '3' });

    expect(group.path).toBe('/api/ruler/ds-uid/api/v1/rules/test-ns/test-gr');
    expect(group.params).toMatchObject({ subtype: '3' });
  });

  it('Should append source=rules parameter when custom ruler enabled', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex v2',
      apiVersion: 'config',
    };

    mocks.getDatasourceAPIId.mockReturnValue('ds-uid');

    // Act
    const builder = rulerUrlBuilder(config);

    const rules = builder.rules();
    const namespace = builder.namespace('test-ns');
    const group = builder.namespaceGroup('test-ns', 'test-gr');

    // Assert
    expect(rules.params).toMatchObject({ subtype: '3' });
    expect(namespace.params).toMatchObject({ subtype: '3' });
    expect(group.params).toMatchObject({ subtype: '3' });
  });

  it('Should append dashboard_uid and panel_id for rules endpoint when specified', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex v2',
      apiVersion: 'config',
    };

    mocks.getDatasourceAPIId.mockReturnValue('ds-uid');

    // Act
    const builder = rulerUrlBuilder(config);
    const rules = builder.rules({ dashboardUID: 'dashboard-uid', panelId: 1234 });

    // Assert
    expect(rules.params).toMatchObject({ dashboard_uid: 'dashboard-uid', panel_id: '1234', subtype: '3' });
  });
});
