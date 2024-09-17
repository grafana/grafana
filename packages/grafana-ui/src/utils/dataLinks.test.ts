import { isCompactUrl } from './dataLinks';

describe('Datalinks', () => {
  it('isCompactUrl matches compact URL with segments', () => {
    expect(
      isCompactUrl(
        'http://localhost:3000/explore?orgId=1&left=[%22now-1h%22,%22now%22,%22gdev-loki%22,{%22expr%22:%22{place=%22luna%22}%22,%22refId%22:%22A%22}]'
      )
    ).toEqual(true);
  });

  it('isCompactUrl matches compact URL without segments', () => {
    expect(isCompactUrl('http://localhost:3000/explore?orgId=1&left=[%22now-1h%22,%22now%22,%22gdev-loki%22]')).toEqual(
      true
    );
  });

  it('isCompactUrl matches compact URL with right pane', () => {
    expect(
      isCompactUrl('http://localhost:3000/explore?orgId=1&right=[%22now-1h%22,%22now%22,%22gdev-loki%22]')
    ).toEqual(true);
  });

  it('isCompactUrl does not match non-compact url', () => {
    expect(
      isCompactUrl(
        'http://localhost:3000/explore?orgId=1&left={"datasource":"test[datasource]","queries":[{"refId":"A","datasource":{"type":"prometheus","uid":"gdev-prometheus"}}],"range":{"from":"now-1h","to":"now"}}'
      )
    ).toEqual(false);
  });
});
