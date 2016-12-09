(function(QUnit) {

  var Library = Backbone.Collection.extend({
    url: function() { return '/library'; }
  });
  var library;

  var attrs = {
    title: 'The Tempest',
    author: 'Bill Shakespeare',
    length: 123
  };

  QUnit.module('Backbone.sync', {

    beforeEach: function(assert) {
      library = new Library;
      library.create(attrs, {wait: false});
    },

    afterEach: function(assert) {
      Backbone.emulateHTTP = false;
    }

  });

  QUnit.test('read', function(assert) {
    assert.expect(4);
    library.fetch();
    assert.equal(this.ajaxSettings.url, '/library');
    assert.equal(this.ajaxSettings.type, 'GET');
    assert.equal(this.ajaxSettings.dataType, 'json');
    assert.ok(_.isEmpty(this.ajaxSettings.data));
  });

  QUnit.test('passing data', function(assert) {
    assert.expect(3);
    library.fetch({data: {a: 'a', one: 1}});
    assert.equal(this.ajaxSettings.url, '/library');
    assert.equal(this.ajaxSettings.data.a, 'a');
    assert.equal(this.ajaxSettings.data.one, 1);
  });

  QUnit.test('create', function(assert) {
    assert.expect(6);
    assert.equal(this.ajaxSettings.url, '/library');
    assert.equal(this.ajaxSettings.type, 'POST');
    assert.equal(this.ajaxSettings.dataType, 'json');
    var data = JSON.parse(this.ajaxSettings.data);
    assert.equal(data.title, 'The Tempest');
    assert.equal(data.author, 'Bill Shakespeare');
    assert.equal(data.length, 123);
  });

  QUnit.test('update', function(assert) {
    assert.expect(7);
    library.first().save({id: '1-the-tempest', author: 'William Shakespeare'});
    assert.equal(this.ajaxSettings.url, '/library/1-the-tempest');
    assert.equal(this.ajaxSettings.type, 'PUT');
    assert.equal(this.ajaxSettings.dataType, 'json');
    var data = JSON.parse(this.ajaxSettings.data);
    assert.equal(data.id, '1-the-tempest');
    assert.equal(data.title, 'The Tempest');
    assert.equal(data.author, 'William Shakespeare');
    assert.equal(data.length, 123);
  });

  QUnit.test('update with emulateHTTP and emulateJSON', function(assert) {
    assert.expect(7);
    library.first().save({id: '2-the-tempest', author: 'Tim Shakespeare'}, {
      emulateHTTP: true,
      emulateJSON: true
    });
    assert.equal(this.ajaxSettings.url, '/library/2-the-tempest');
    assert.equal(this.ajaxSettings.type, 'POST');
    assert.equal(this.ajaxSettings.dataType, 'json');
    assert.equal(this.ajaxSettings.data._method, 'PUT');
    var data = JSON.parse(this.ajaxSettings.data.model);
    assert.equal(data.id, '2-the-tempest');
    assert.equal(data.author, 'Tim Shakespeare');
    assert.equal(data.length, 123);
  });

  QUnit.test('update with just emulateHTTP', function(assert) {
    assert.expect(6);
    library.first().save({id: '2-the-tempest', author: 'Tim Shakespeare'}, {
      emulateHTTP: true
    });
    assert.equal(this.ajaxSettings.url, '/library/2-the-tempest');
    assert.equal(this.ajaxSettings.type, 'POST');
    assert.equal(this.ajaxSettings.contentType, 'application/json');
    var data = JSON.parse(this.ajaxSettings.data);
    assert.equal(data.id, '2-the-tempest');
    assert.equal(data.author, 'Tim Shakespeare');
    assert.equal(data.length, 123);
  });

  QUnit.test('update with just emulateJSON', function(assert) {
    assert.expect(6);
    library.first().save({id: '2-the-tempest', author: 'Tim Shakespeare'}, {
      emulateJSON: true
    });
    assert.equal(this.ajaxSettings.url, '/library/2-the-tempest');
    assert.equal(this.ajaxSettings.type, 'PUT');
    assert.equal(this.ajaxSettings.contentType, 'application/x-www-form-urlencoded');
    var data = JSON.parse(this.ajaxSettings.data.model);
    assert.equal(data.id, '2-the-tempest');
    assert.equal(data.author, 'Tim Shakespeare');
    assert.equal(data.length, 123);
  });

  QUnit.test('read model', function(assert) {
    assert.expect(3);
    library.first().save({id: '2-the-tempest', author: 'Tim Shakespeare'});
    library.first().fetch();
    assert.equal(this.ajaxSettings.url, '/library/2-the-tempest');
    assert.equal(this.ajaxSettings.type, 'GET');
    assert.ok(_.isEmpty(this.ajaxSettings.data));
  });

  QUnit.test('destroy', function(assert) {
    assert.expect(3);
    library.first().save({id: '2-the-tempest', author: 'Tim Shakespeare'});
    library.first().destroy({wait: true});
    assert.equal(this.ajaxSettings.url, '/library/2-the-tempest');
    assert.equal(this.ajaxSettings.type, 'DELETE');
    assert.equal(this.ajaxSettings.data, null);
  });

  QUnit.test('destroy with emulateHTTP', function(assert) {
    assert.expect(3);
    library.first().save({id: '2-the-tempest', author: 'Tim Shakespeare'});
    library.first().destroy({
      emulateHTTP: true,
      emulateJSON: true
    });
    assert.equal(this.ajaxSettings.url, '/library/2-the-tempest');
    assert.equal(this.ajaxSettings.type, 'POST');
    assert.equal(JSON.stringify(this.ajaxSettings.data), '{"_method":"DELETE"}');
  });

  QUnit.test('urlError', function(assert) {
    assert.expect(2);
    var model = new Backbone.Model();
    assert.raises(function() {
      model.fetch();
    });
    model.fetch({url: '/one/two'});
    assert.equal(this.ajaxSettings.url, '/one/two');
  });

  QUnit.test('#1052 - `options` is optional.', function(assert) {
    assert.expect(0);
    var model = new Backbone.Model();
    model.url = '/test';
    Backbone.sync('create', model);
  });

  QUnit.test('Backbone.ajax', function(assert) {
    assert.expect(1);
    Backbone.ajax = function(settings) {
      assert.strictEqual(settings.url, '/test');
    };
    var model = new Backbone.Model();
    model.url = '/test';
    Backbone.sync('create', model);
  });

  QUnit.test('Call provided error callback on error.', function(assert) {
    assert.expect(1);
    var model = new Backbone.Model;
    model.url = '/test';
    Backbone.sync('read', model, {
      error: function() { assert.ok(true); }
    });
    this.ajaxSettings.error();
  });

  QUnit.test('Use Backbone.emulateHTTP as default.', function(assert) {
    assert.expect(2);
    var model = new Backbone.Model;
    model.url = '/test';

    Backbone.emulateHTTP = true;
    model.sync('create', model);
    assert.strictEqual(this.ajaxSettings.emulateHTTP, true);

    Backbone.emulateHTTP = false;
    model.sync('create', model);
    assert.strictEqual(this.ajaxSettings.emulateHTTP, false);
  });

  QUnit.test('Use Backbone.emulateJSON as default.', function(assert) {
    assert.expect(2);
    var model = new Backbone.Model;
    model.url = '/test';

    Backbone.emulateJSON = true;
    model.sync('create', model);
    assert.strictEqual(this.ajaxSettings.emulateJSON, true);

    Backbone.emulateJSON = false;
    model.sync('create', model);
    assert.strictEqual(this.ajaxSettings.emulateJSON, false);
  });

  QUnit.test('#1756 - Call user provided beforeSend function.', function(assert) {
    assert.expect(4);
    Backbone.emulateHTTP = true;
    var model = new Backbone.Model;
    model.url = '/test';
    var xhr = {
      setRequestHeader: function(header, value) {
        assert.strictEqual(header, 'X-HTTP-Method-Override');
        assert.strictEqual(value, 'DELETE');
      }
    };
    model.sync('delete', model, {
      beforeSend: function(_xhr) {
        assert.ok(_xhr === xhr);
        return false;
      }
    });
    assert.strictEqual(this.ajaxSettings.beforeSend(xhr), false);
  });

  QUnit.test('#2928 - Pass along `textStatus` and `errorThrown`.', function(assert) {
    assert.expect(2);
    var model = new Backbone.Model;
    model.url = '/test';
    model.on('error', function(m, xhr, options) {
      assert.strictEqual(options.textStatus, 'textStatus');
      assert.strictEqual(options.errorThrown, 'errorThrown');
    });
    model.fetch();
    this.ajaxSettings.error({}, 'textStatus', 'errorThrown');
  });

})(QUnit);
