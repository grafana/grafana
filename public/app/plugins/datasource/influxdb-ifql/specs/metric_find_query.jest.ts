import expandMacros from '../metric_find_query';

describe('metric find query', () => {
  describe('expandMacros()', () => {
    it('returns a non-macro query unadulterated', () => {
      const query = 'from(db:"telegraf") |> last()';
      const result = expandMacros(query);
      expect(result).toBe(query);
    });

    it('returns a measurement query for measurements()', () => {
      const query = ' measurements(mydb) ';
      const result = expandMacros(query).replace(/\s/g, '');
      expect(result).toBe(
        'from(db:"mydb")|>range($range)|>group(by:["_measurement"])|>distinct(column:"_measurement")|>group(none:true)'
      );
    });

    it('returns a tags query for tags()', () => {
      const query = ' tags(mydb , mymetric) ';
      const result = expandMacros(query).replace(/\s/g, '');
      expect(result).toBe('from(db:"mydb")|>range($range)|>filter(fn:(r)=>r._measurement=="mymetric")|>keys()');
    });

    it('returns a tag values query for tag_values()', () => {
      const query = ' tag_values(mydb , mymetric, mytag) ';
      const result = expandMacros(query).replace(/\s/g, '');
      expect(result).toBe(
        'from(db:"mydb")|>range($range)|>filter(fn:(r)=>r._measurement=="mymetric")' +
          '|>group(by:["mytag"])|>distinct(column:"mytag")|>group(none:true)'
      );
    });

    it('returns a field keys query for field_keys()', () => {
      const query = ' field_keys(mydb , mymetric) ';
      const result = expandMacros(query).replace(/\s/g, '');
      expect(result).toBe(
        'from(db:"mydb")|>range($range)|>filter(fn:(r)=>r._measurement=="mymetric")' +
          '|>group(by:["_field"])|>distinct(column:"_field")|>group(none:true)'
      );
    });
  });
});
