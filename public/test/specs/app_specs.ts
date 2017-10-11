import {describe, it, expect} from 'test/lib/common';

import {GrafanaApp} from 'app/app';

describe('GrafanaApp', () => {

  var app = new GrafanaApp();

  it('can call inits', () => {
    expect(app).to.not.be(null);
  });
});


