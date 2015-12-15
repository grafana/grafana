/* */ 
'use strict';
var e2e_util_1 = require('../../../../src/testing/e2e_util');
function waitForElement(selector) {
  var EC = protractor.ExpectedConditions;
  browser.wait(EC.presenceOf($(selector)), 20000);
}
function waitForAlert() {
  var EC = protractor.ExpectedConditions;
  browser.wait(EC.alertIsPresent(), 1000);
}
describe('can deactivate example app', function() {
  afterEach(e2e_util_1.verifyNoBrowserErrors);
  var URL = 'angular2/examples/router/ts/can_deactivate/';
  it('should not navigate away when prompt is cancelled', function() {
    browser.get(URL);
    waitForElement('note-index-cmp');
    element(by.css('#note-1-link')).click();
    waitForElement('note-cmp');
    browser.navigate().back();
    waitForAlert();
    browser.switchTo().alert().dismiss();
    expect(element(by.css('note-cmp')).getText()).toContain('id: 1');
  });
  it('should navigate away when prompt is confirmed', function() {
    browser.get(URL);
    waitForElement('note-index-cmp');
    element(by.css('#note-1-link')).click();
    waitForElement('note-cmp');
    browser.navigate().back();
    waitForAlert();
    browser.switchTo().alert().accept();
    waitForElement('note-index-cmp');
    expect(element(by.css('note-index-cmp')).getText()).toContain('Your Notes');
  });
});
