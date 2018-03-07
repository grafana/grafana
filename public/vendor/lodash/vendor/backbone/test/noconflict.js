(function(QUnit) {

  QUnit.module('Backbone.noConflict');

  QUnit.test('noConflict', function(assert) {
    assert.expect(2);
    var noconflictBackbone = Backbone.noConflict();
    assert.equal(window.Backbone, undefined, 'Returned window.Backbone');
    window.Backbone = noconflictBackbone;
    assert.equal(window.Backbone, noconflictBackbone, 'Backbone is still pointing to the original Backbone');
  });

})(QUnit);
