/* */ 
'use strict';
var e2e_util_1 = require('../../../../src/testing/e2e_util');
function waitForElement(selector) {
  var EC = protractor.ExpectedConditions;
  browser.wait(EC.presenceOf($(selector)), 20000);
}
describe('reuse example app', function() {
  afterEach(e2e_util_1.verifyNoBrowserErrors);
  var URL = 'angular2/examples/router/ts/reuse/';
  it('should build a link which points to the detail page', function() {
    browser.get(URL);
    waitForElement('my-cmp');
    element(by.css('#naomi-link')).click();
    waitForElement('my-cmp');
    expect(browser.getCurrentUrl()).toMatch(/\/naomi$/);
    element(by.css('#message')).sendKeys('long time no see!');
    element(by.css('#brad-link')).click();
    waitForElement('my-cmp');
    expect(browser.getCurrentUrl()).toMatch(/\/brad$/);
    expect(element(by.css('#message')).getAttribute('value')).toEqual('long time no see!');
  });
});
