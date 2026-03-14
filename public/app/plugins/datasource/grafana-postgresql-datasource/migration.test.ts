import { SceneObject } from '@grafana/scenes';

import {
  getRepeatInfo,
  isVariableQuotedInQuery,
  migrateInterpolation,
  PanelRepeatInfo,
  stripOuterQuotes,
} from './migration';

const quoteLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

function createMockSceneObject(name: string, state: Record<string, unknown> = {}, parent?: SceneObject): SceneObject {
  const obj = {
    state: { ...state },
    parent,
  } as unknown as SceneObject;

  Object.defineProperty(obj, 'constructor', {
    value: { name },
  });

  return obj;
}

function createMockVizPanel(
  state: Partial<{ title: string; key: string; pluginId: string; repeatSourceKey?: string }> = {},
  parentState: Partial<{ variableName?: string; repeatDirection?: 'v' | 'h'; repeatedPanels?: unknown[] }> = {}
): SceneObject {
  const gridItem = createMockSceneObject('DashboardGridItem', parentState);
  return createMockSceneObject('VizPanel', state, gridItem);
}

function createNestedSceneObject(
  vizPanelState: Partial<{ title: string; key: string; pluginId: string; repeatSourceKey?: string }> = {},
  parentState: Partial<{ variableName?: string; repeatDirection?: 'v' | 'h'; repeatedPanels?: unknown[] }> = {}
): SceneObject {
  const vizPanel = createMockVizPanel(vizPanelState, parentState);
  return createMockSceneObject('SceneQueryRunner', {}, vizPanel);
}

describe('isVariableQuotedInQuery', () => {
  it('should detect $var wrapped in single quotes', () => {
    expect(isVariableQuotedInQuery('host', "WHERE host = '$host'")).toBe(true);
  });

  it('should detect ${var} wrapped in single quotes', () => {
    expect(isVariableQuotedInQuery('host', "WHERE host = '${host}'")).toBe(true);
  });

  it('should return false when $var is not quoted', () => {
    expect(isVariableQuotedInQuery('host', 'WHERE host = $host')).toBe(false);
  });

  it('should return false when ${var} is not quoted', () => {
    expect(isVariableQuotedInQuery('host', 'WHERE host = ${host}')).toBe(false);
  });

  it('should return false for IN clause without quotes around variable', () => {
    expect(isVariableQuotedInQuery('host', 'WHERE host IN ($host)')).toBe(false);
  });

  it('should detect variable in complex query', () => {
    expect(isVariableQuotedInQuery('host', "SELECT * FROM metrics WHERE host = '$host' ORDER BY time")).toBe(true);
  });

  it('should not match a different variable name', () => {
    expect(isVariableQuotedInQuery('server', "WHERE host = '$host'")).toBe(false);
  });

  it('should handle variable names with special regex characters', () => {
    expect(isVariableQuotedInQuery('host.name', "WHERE x = '$host.name'")).toBe(true);
  });

  it('should handle multiple occurrences where at least one is quoted', () => {
    expect(isVariableQuotedInQuery('host', "WHERE a = '$host' AND b = $host")).toBe(true);
  });
});

describe('stripOuterQuotes', () => {
  it('should strip outer single quotes', () => {
    expect(stripOuterQuotes("'value'")).toBe('value');
  });

  it('should preserve inner escaped quotes', () => {
    expect(stripOuterQuotes("'O''Brien'")).toBe("O''Brien");
  });

  it('should return value unchanged if not quoted', () => {
    expect(stripOuterQuotes('value')).toBe('value');
  });

  it('should return value unchanged for single character quote', () => {
    expect(stripOuterQuotes("'")).toBe("'");
  });

  it('should handle empty quoted string', () => {
    expect(stripOuterQuotes("''")).toBe('');
  });

  it('should not strip if only leading quote', () => {
    expect(stripOuterQuotes("'value")).toBe("'value");
  });

  it('should not strip if only trailing quote', () => {
    expect(stripOuterQuotes("value'")).toBe("value'");
  });
});

describe('getRepeatInfo', () => {
  it('should return undefined when no scene object is provided', () => {
    expect(getRepeatInfo(undefined)).toBeUndefined();
  });

  it('should return undefined when no VizPanel is in the parent chain', () => {
    const scene = createMockSceneObject('SomeOtherObject');
    expect(getRepeatInfo(scene)).toBeUndefined();
  });

  it('should detect a repeated panel (clone)', () => {
    const scene = createNestedSceneObject(
      { repeatSourceKey: 'panel-1', title: 'Clone', key: 'panel-1-clone-0' },
      { variableName: 'host', repeatDirection: 'h' }
    );

    const info = getRepeatInfo(scene) as PanelRepeatInfo;
    expect(info).toBeDefined();
    expect(info.isRepeated).toBe(true);
    expect(info.variableName).toBe('host');
  });

  it('should detect a source panel (not a clone)', () => {
    const scene = createNestedSceneObject({ title: 'Source', key: 'panel-1' }, { variableName: 'host' });

    const info = getRepeatInfo(scene) as PanelRepeatInfo;
    expect(info).toBeDefined();
    expect(info.isRepeated).toBe(false);
    expect(info.variableName).toBe('host');
  });

  it('should report no repeat when parent has no variableName', () => {
    const scene = createNestedSceneObject({ title: 'Regular', key: 'panel-2' }, {});

    const info = getRepeatInfo(scene) as PanelRepeatInfo;
    expect(info).toBeDefined();
    expect(info.isRepeated).toBe(false);
    expect(info.variableName).toBeUndefined();
  });
});

describe('migrateInterpolation', () => {
  describe('without scene context (no migration applied)', () => {
    it('should pass through a quoted string unchanged', () => {
      expect(migrateInterpolation("'value1'", 'host')).toBe("'value1'");
    });

    it('should pass through a comma-separated array string unchanged', () => {
      expect(migrateInterpolation("'a','b'", 'host')).toBe("'a','b'");
    });

    it('should pass through a number unchanged', () => {
      expect(migrateInterpolation(42, 'host')).toBe(42);
    });

    it('should pass through an unquoted string unchanged', () => {
      expect(migrateInterpolation('server1', 'host')).toBe('server1');
    });
  });

  describe('with repeated panel and quoted variable in SQL', () => {
    it('should strip outer quotes for multi variable (single value on repeated clone)', () => {
      const scene = createNestedSceneObject({ repeatSourceKey: 'panel-1' }, { variableName: 'host' });
      const rawSql = "SELECT * FROM metrics WHERE host = '$host'";
      const interpolated = quoteLiteral('server1');

      expect(migrateInterpolation(interpolated, 'host', rawSql, scene)).toBe('server1');
    });

    it('should strip outer quotes and preserve escaped inner quotes', () => {
      const scene = createNestedSceneObject({ repeatSourceKey: 'panel-1' }, { variableName: 'host' });
      const rawSql = "SELECT * FROM metrics WHERE host = '$host'";
      const interpolated = quoteLiteral("O'Brien");

      expect(migrateInterpolation(interpolated, 'host', rawSql, scene)).toBe("O''Brien");
    });

    it('should strip outer quotes for source panel too', () => {
      const scene = createNestedSceneObject({ title: 'Source' }, { variableName: 'host' });
      const rawSql = "SELECT * FROM metrics WHERE host = '$host'";
      const interpolated = quoteLiteral('server1');

      expect(migrateInterpolation(interpolated, 'host', rawSql, scene)).toBe('server1');
    });

    it('should strip outer quotes with ${var} syntax', () => {
      const scene = createNestedSceneObject({ repeatSourceKey: 'panel-1' }, { variableName: 'host' });
      const rawSql = "SELECT * FROM metrics WHERE host = '${host}'";
      const interpolated = quoteLiteral('server1');

      expect(migrateInterpolation(interpolated, 'host', rawSql, scene)).toBe('server1');
    });
  });

  describe('with repeated panel but unquoted variable in SQL', () => {
    it('should NOT strip quotes when variable is not quoted in SQL', () => {
      const scene = createNestedSceneObject({ repeatSourceKey: 'panel-1' }, { variableName: 'host' });
      const rawSql = 'SELECT * FROM metrics WHERE host = $host';
      const interpolated = quoteLiteral('server1');

      expect(migrateInterpolation(interpolated, 'host', rawSql, scene)).toBe("'server1'");
    });

    it('should NOT strip quotes for IN clause without quoted variable', () => {
      const scene = createNestedSceneObject({ repeatSourceKey: 'panel-1' }, { variableName: 'host' });
      const rawSql = 'SELECT * FROM metrics WHERE host IN ($host)';
      const interpolated = quoteLiteral('server1');

      expect(migrateInterpolation(interpolated, 'host', rawSql, scene)).toBe("'server1'");
    });
  });

  describe('with non-repeated panel (no migration)', () => {
    it('should not strip quotes even if variable is quoted in SQL', () => {
      const scene = createNestedSceneObject({ title: 'Regular' }, {});
      const rawSql = "SELECT * FROM metrics WHERE host = '$host'";
      const interpolated = quoteLiteral('server1');

      expect(migrateInterpolation(interpolated, 'host', rawSql, scene)).toBe("'server1'");
    });
  });

  describe('non-multi string values on repeated panels', () => {
    it('should not alter unquoted values (escape-only result from parent)', () => {
      const scene = createNestedSceneObject({ repeatSourceKey: 'panel-1' }, { variableName: 'host' });
      const rawSql = "SELECT * FROM metrics WHERE host = '$host'";
      const interpolated = 'server1';

      expect(migrateInterpolation(interpolated, 'host', rawSql, scene)).toBe('server1');
    });
  });

  describe('array results on repeated panels', () => {
    it('should not affect comma-separated array results (not wrapped in a single outer quote pair)', () => {
      const scene = createNestedSceneObject({ repeatSourceKey: 'panel-1' }, { variableName: 'host' });
      const rawSql = 'SELECT * FROM metrics WHERE host IN ($host)';
      const interpolated = "'a','b','c'";

      expect(migrateInterpolation(interpolated, 'host', rawSql, scene)).toBe("'a','b','c'");
    });
  });

  describe('number values on repeated panels', () => {
    it('should pass through numbers without migration', () => {
      const scene = createNestedSceneObject({ repeatSourceKey: 'panel-1' }, { variableName: 'host' });
      const rawSql = 'SELECT * FROM metrics WHERE id = $host';

      expect(migrateInterpolation(42, 'host', rawSql, scene)).toBe(42);
    });
  });

  describe('different variable than repeat variable', () => {
    it('should still strip quotes if the interpolated variable is quoted in SQL', () => {
      const scene = createNestedSceneObject({ repeatSourceKey: 'panel-1' }, { variableName: 'host' });
      const rawSql = "SELECT * FROM metrics WHERE host = '$host' AND env = '$env'";
      const interpolated = quoteLiteral('production');

      expect(migrateInterpolation(interpolated, 'env', rawSql, scene)).toBe('production');
    });

    it('should not strip quotes if the other variable is not quoted', () => {
      const scene = createNestedSceneObject({ repeatSourceKey: 'panel-1' }, { variableName: 'host' });
      const rawSql = "SELECT * FROM metrics WHERE host = '$host' AND env = $env";
      const interpolated = quoteLiteral('production');

      expect(migrateInterpolation(interpolated, 'env', rawSql, scene)).toBe("'production'");
    });
  });
});
