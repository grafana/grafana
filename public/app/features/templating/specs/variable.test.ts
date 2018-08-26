import { containsVariable, assignModelProperties } from '../variable';

describe('containsVariable', function() {
  describe('when checking if a string contains a variable', function() {
    it('should find it with $const syntax', function() {
      const contains = containsVariable('this.$test.filters', 'test');
      expect(contains).toBe(true);
    });

    it('should not find it if only part matches with $const syntax', function() {
      const contains = containsVariable('this.$serverDomain.filters', 'server');
      expect(contains).toBe(false);
    });

    it('should find it if it ends with variable and passing multiple test strings', function() {
      const contains = containsVariable('show field keys from $pgmetric', 'test string2', 'pgmetric');
      expect(contains).toBe(true);
    });

    it('should find it with [[var]] syntax', function() {
      const contains = containsVariable('this.[[test]].filters', 'test');
      expect(contains).toBe(true);
    });

    it('should find it when part of segment', function() {
      const contains = containsVariable('metrics.$env.$group-*', 'group');
      expect(contains).toBe(true);
    });

    it('should find it its the only thing', function() {
      const contains = containsVariable('$env', 'env');
      expect(contains).toBe(true);
    });

    it('should be able to pass in multiple test strings', function() {
      const contains = containsVariable('asd', 'asd2.$env', 'env');
      expect(contains).toBe(true);
    });
  });
});

describe('assignModelProperties', function() {
  it('only set properties defined in defaults', function() {
    const target: any = { test: 'asd' };
    assignModelProperties(target, { propA: 1, propB: 2 }, { propB: 0 });
    expect(target.propB).toBe(2);
    expect(target.test).toBe('asd');
  });

  it('use default value if not found on source', function() {
    const target: any = { test: 'asd' };
    assignModelProperties(target, { propA: 1, propB: 2 }, { propC: 10 });
    expect(target.propC).toBe(10);
  });
});
