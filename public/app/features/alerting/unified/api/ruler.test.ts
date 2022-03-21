import { RulerDataSourceConfig } from 'app/types/unified-alerting';
import { getDatasourceAPIId } from '../utils/datasource';
import { rulerUrlBuilder } from './ruler';

jest.mock('../utils/datasource');

const mocks = {
  getDatasourceAPIId: jest.mocked(getDatasourceAPIId),
};

describe('rulerUrlBuilder', () => {
  it('Should use /api/v1/rules endpoint with noProxy param for legacy api version', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex',
      apiVersion: 'legacy',
      customRulerEnabled: false,
    };

    mocks.getDatasourceAPIId.mockReturnValue('ds-uid');

    // Act
    const builder = rulerUrlBuilder(config);

    const rules = builder.rules();
    const namespace = builder.namespace('test-ns');
    const group = builder.namespaceGroup('test-ns', 'test-gr');

    // Assert
    expect(rules.path).toBe('/api/ruler/ds-uid/api/v1/rules');
    expect(rules.params).toMatchObject({ noProxy: 'true' });

    expect(namespace.path).toBe('/api/ruler/ds-uid/api/v1/rules/test-ns');
    expect(namespace.params).toMatchObject({ noProxy: 'true' });

    expect(group.path).toBe('/api/ruler/ds-uid/api/v1/rules/test-ns/test-gr');
    expect(group.params).toMatchObject({ noProxy: 'true' });
  });

  it('Should use /config/v1/rules endpoint for config api version', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex v2',
      apiVersion: 'config',
      customRulerEnabled: false,
    };

    mocks.getDatasourceAPIId.mockReturnValue('ds-uid');

    // Act
    const builder = rulerUrlBuilder(config);

    const rules = builder.rules();
    const namespace = builder.namespace('test-ns');
    const group = builder.namespaceGroup('test-ns', 'test-gr');

    // Assert
    expect(rules.path).toBe('/api/ruler/ds-uid/config/v1/rules');
    expect(rules.params).toMatchObject({});

    expect(namespace.path).toBe('/api/ruler/ds-uid/config/v1/rules/test-ns');
    expect(namespace.params).toMatchObject({});

    expect(group.path).toBe('/api/ruler/ds-uid/config/v1/rules/test-ns/test-gr');
    expect(group.params).toMatchObject({});
  });

  it('Should append source=rules parameter when custom ruler enabled', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex v2',
      apiVersion: 'config',
      customRulerEnabled: true,
    };

    mocks.getDatasourceAPIId.mockReturnValue('ds-uid');

    // Act
    const builder = rulerUrlBuilder(config);

    const rules = builder.rules();
    const namespace = builder.namespace('test-ns');
    const group = builder.namespaceGroup('test-ns', 'test-gr');

    // Assert
    expect(rules.params).toMatchObject({ source: 'ruler' });
    expect(namespace.params).toMatchObject({ source: 'ruler' });
    expect(group.params).toMatchObject({ source: 'ruler' });
  });

  it('Should append dashboard_uid and panel_id for rules endpoint when specified', () => {
    // Arrange
    const config: RulerDataSourceConfig = {
      dataSourceName: 'Cortex v2',
      apiVersion: 'config',
      customRulerEnabled: false,
    };

    mocks.getDatasourceAPIId.mockReturnValue('ds-uid');

    // Act
    const builder = rulerUrlBuilder(config);
    const rules = builder.rules({ dashboardUID: 'dashboard-uid', panelId: 1234 });

    // Assert
    expect(rules.params).toMatchObject({ dashboard_uid: 'dashboard-uid', panel_id: '1234' });
  });
});
