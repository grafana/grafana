define([
  'app/plugins/datasource/prometheus/template'
], function(template) {
  'use strict';

  var one = function(templ) {
    return template.renderTemplate(templ, {
      'foo': 'bar',
      'baz': 'quux',
      'before': '  right',
      'after': 'left  ',
      'host': 'foo.west-coast',
      'cluster': 'west-coast',
    });
  };

  describe('promTemplate', function() {
    describe('renderTemplate', function() {
      it('has the 3.1 behaviour', function() {
        expect(one('foo')).to.be('foo');
        expect(one('{{ foo }}')).to.be('bar');
        expect(one('{{ foo }} {{ baz }}')).to.be('bar quux');
        expect(one('{{ foo }} is {{ baz }}')).to.be('bar is quux');
        var s = 'replace whoopdee "doo \'';
        expect(one(s)).to.be(s);

        expect(one('{{ downright invalid }}')).to.be('downright invalid');
        expect(one('{{ unrecognised }}')).to.be('unrecognised');
      });

      it('can do a simple replace', function() {
        expect(one('{{ foo | replace("a", "ee") }}')).to.be('beer');
        expect(one('{{ "foo" | replace("oo", "d") }}')).to.be('fd');
      });

      it('can do a chained replace', function() {
        expect(one(
            '{{ foo | replace("a", "ee") | replace("er", "an") }}'))
            .to.be('bean');
      });

      it('can do a replace with vars', function() {
        expect(one('{{ host | replace(cluster, "ee") }}'))
            .to.be('foo.ee');
      });


      it('can do percentages', function() {
        expect(one('{{ "0.5" | toPercent() }}')).to.be('50%');
      });
    });
  });
});
