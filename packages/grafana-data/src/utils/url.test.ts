import { urlUtil } from './url';

describe('toUrlParams', () => {
  it('should encode object properties as url parameters', () => {
    const url = urlUtil.toUrlParams({
      server: 'backend-01',
      hasSpace: 'has space',
      many: ['1', '2', '3'],
      true: true,
      number: 20,
      isNull: null,
      isUndefined: undefined,
    });
    expect(url).toBe('server=backend-01&hasSpace=has%20space&many=1&many=2&many=3&true&number=20&isNull=&isUndefined=');
  });
});

describe('toUrlParams', () => {
  it('should encode the same way as angularjs', () => {
    const url = urlUtil.toUrlParams({
      server: ':@',
    });
    expect(url).toBe('server=:@');
  });
});

describe('parseKeyValue', () => {
  it('should parse url search params to object', () => {
    const obj = urlUtil.parseKeyValue('param=value&param2=value2&kiosk');
    expect(obj).toEqual({ param: 'value', param2: 'value2', kiosk: true });
  });

  it('should parse same url key multiple times to array', () => {
    const obj = urlUtil.parseKeyValue('servers=A&servers=B');
    expect(obj).toEqual({ servers: ['A', 'B'] });
  });

  it('should parse numeric params', () => {
    const obj = urlUtil.parseKeyValue('num1=12&num2=12.2');
    expect(obj).toEqual({ num1: '12', num2: '12.2' });
  });

  it('should not parse empty string as number', () => {
    const obj = urlUtil.parseKeyValue('num1=&num2=12.2');
    expect(obj).toEqual({ num1: '', num2: '12.2' });
  });

  it('should parse boolean params', () => {
    const obj = urlUtil.parseKeyValue('bool1&bool2=true&bool3=false');
    expect(obj).toEqual({ bool1: true, bool2: true, bool3: false });
  });

  it('should parse number like params as strings', () => {
    const obj = urlUtil.parseKeyValue('custom=&custom1=001&custom2=002&custom3');
    expect(obj).toEqual({ custom: '', custom1: '001', custom2: '002', custom3: true });
  });
});

describe('getUrlSearchParams', () => {
  const { location } = window;
  // @ts-ignore
  delete window.location;

  window.location = {
    ...location,
    hash: '#hash',
    host: 'www.domain.com:9877',
    hostname: 'www.domain.com',
    href: 'http://www.domain.com:9877/path/b?var1=a&var2=b&var2=c&var2=d&var3=a&var3=d&z#hash',
    origin: 'http://www.domain.com:9877',
    pathname: '/path/b',
    port: '9877',
    protocol: 'http:',
    search: '?var1=a&var2=b&var2=c&var2=d&var3=a&var3=d&z',
  };

  let expectedParams = {
    var1: ['a'],
    var2: ['b', 'c', 'd'],
    var3: ['a', 'd'],
    z: true,
  };

  it('should take into account multi-value and boolean parameters', () => {
    const params = urlUtil.getUrlSearchParams();
    expect(params).toStrictEqual(expectedParams);
  });
});
