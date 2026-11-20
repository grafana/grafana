import { isHttpUrl } from './url';

describe('isHttpUrl', () => {
  it.each([
    { url: 'https://example.com/path', expected: true },
    { url: 'http://localhost:3000', expected: true },
    { url: 'ftp://files.example.com', expected: false },
    { url: 'javascript:alert(1)', expected: false },
    { url: '/dashboards', expected: false },
    { url: 'not a url', expected: false },
  ])('"$url" returns $expected', ({ url, expected }) => {
    expect(isHttpUrl(url)).toBe(expected);
  });
});
