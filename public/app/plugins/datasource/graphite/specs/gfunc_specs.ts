///<amd-dependency path="app/plugins/datasource/graphite/gfunc" name="gfunc" />

import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';
import gfunc from '../gfunc';

describe('when creating func instance from func names', function() {
  it('should return func instance', function() {
    var func = gfunc.createFuncInstance('sumSeries');
    expect(func).to.be.ok();
    expect(func.def.name).to.equal('sumSeries');
    expect(func.def.params.length).to.equal(5);
    expect(func.def.defaultParams.length).to.equal(1);
  });

  it('should return func instance with shortName', function() {
    var func = gfunc.createFuncInstance('sum');
    expect(func).to.be.ok();
  });

  it('should return func instance from funcDef', function() {
    var func = gfunc.createFuncInstance('sum');
    var func2 = gfunc.createFuncInstance(func.def);
    expect(func2).to.be.ok();
  });

  it('func instance should have text representation', function() {
    var func = gfunc.createFuncInstance('groupByNode');
    func.params[0] = 5;
    func.params[1] = 'avg';
    func.updateText();
    expect(func.text).to.equal("groupByNode(5, avg)");
  });
});

describe('when rendering func instance', function() {

  it('should handle single metric param', function() {
    var func = gfunc.createFuncInstance('sumSeries');
    expect(func.render('hello.metric')).to.equal("sumSeries(hello.metric)");
  });

  it('should include default params if options enable it', function() {
    var func = gfunc.createFuncInstance('scaleToSeconds', { withDefaultParams: true });
    expect(func.render('hello')).to.equal("scaleToSeconds(hello, 1)");
  });

  it('should handle int or interval params with number', function() {
    var func = gfunc.createFuncInstance('movingMedian');
    func.params[0] = '5';
    expect(func.render('hello')).to.equal("movingMedian(hello, 5)");
  });

  it('should handle int or interval params with interval string', function() {
    var func = gfunc.createFuncInstance('movingMedian');
    func.params[0] = '5min';
    expect(func.render('hello')).to.equal("movingMedian(hello, '5min')");
  });

  it('should handle metric param and int param and string param', function() {
    var func = gfunc.createFuncInstance('groupByNode');
    func.params[0] = 5;
    func.params[1] = 'avg';
    expect(func.render('hello.metric')).to.equal("groupByNode(hello.metric, 5, 'avg')");
  });

  it('should handle function with no metric param', function() {
    var func = gfunc.createFuncInstance('randomWalk');
    func.params[0] = 'test';
    expect(func.render(undefined)).to.equal("randomWalk('test')");
  });

  it('should handle function multiple series params', function() {
    var func = gfunc.createFuncInstance('asPercent');
    func.params[0] = '#B';
    expect(func.render('#A')).to.equal("asPercent(#A, #B)");
  });

});

describe('when requesting function categories', function() {
  it('should return function categories', function() {
    var catIndex = gfunc.getCategories();
    expect(catIndex.Special.length).to.be.greaterThan(8);
  });
});

describe('when updating func param', function() {
  it('should update param value and update text representation', function() {
    var func = gfunc.createFuncInstance('summarize', { withDefaultParams: true });
    func.updateParam('1h', 0);
    expect(func.params[0]).to.be('1h');
    expect(func.text).to.be('summarize(1h, sum, false)');
  });

  it('should parse numbers as float', function() {
    var func = gfunc.createFuncInstance('scale');
    func.updateParam('0.001', 0);
    expect(func.params[0]).to.be('0.001');
  });
});

describe('when updating func param with optional second parameter', function() {
  it('should update value and text', function() {
    var func = gfunc.createFuncInstance('aliasByNode');
    func.updateParam('1', 0);
    expect(func.params[0]).to.be('1');
  });

  it('should slit text and put value in second param', function() {
    var func = gfunc.createFuncInstance('aliasByNode');
    func.updateParam('4,-5', 0);
    expect(func.params[0]).to.be('4');
    expect(func.params[1]).to.be('-5');
    expect(func.text).to.be('aliasByNode(4, -5)');
  });

  it('should remove second param when empty string is set', function() {
    var func = gfunc.createFuncInstance('aliasByNode');
    func.updateParam('4,-5', 0);
    func.updateParam('', 1);
    expect(func.params[0]).to.be('4');
    expect(func.params[1]).to.be(undefined);
    expect(func.text).to.be('aliasByNode(4)');
  });
});

