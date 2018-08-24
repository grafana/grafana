import { AdhocVariable } from '../adhoc_variable';

describe('AdhocVariable', function() {
  describe('when serializing to url', function() {
    it('should set return key value and op separated by pipe', function() {
      var variable = new AdhocVariable({
        filters: [
          { key: 'key1', operator: '=', value: 'value1' },
          { key: 'key2', operator: '!=', value: 'value2' },
          { key: 'key3', operator: '=', value: 'value3a|value3b|value3c' },
        ],
      });
      var urlValue = variable.getValueForUrl();
      expect(urlValue).toMatchObject(['key1|=|value1', 'key2|!=|value2', 'key3|=|value3a__gfp__value3b__gfp__value3c']);
    });
  });

  describe('when deserializing from url', function() {
    it('should restore filters', function() {
      var variable = new AdhocVariable({});
      variable.setValueFromUrl(['key1|=|value1', 'key2|!=|value2', 'key3|=|value3a__gfp__value3b__gfp__value3c']);

      expect(variable.filters[0].key).toBe('key1');
      expect(variable.filters[0].operator).toBe('=');
      expect(variable.filters[0].value).toBe('value1');

      expect(variable.filters[1].key).toBe('key2');
      expect(variable.filters[1].operator).toBe('!=');
      expect(variable.filters[1].value).toBe('value2');

      expect(variable.filters[2].key).toBe('key3');
      expect(variable.filters[2].operator).toBe('=');
      expect(variable.filters[2].value).toBe('value3a|value3b|value3c');
    });
  });
});
