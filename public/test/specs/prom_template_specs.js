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
    });
  });
});
