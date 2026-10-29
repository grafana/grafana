import { enforcingTrustedTypesPolicy } from './trustedTypesPolicy';

it('escapes script tags without changing ordinary markup', () => {
  expect(enforcingTrustedTypesPolicy.createHTML('<p>Hello</p><ScRiPt>alert(1)</script>')).toBe(
    '<p>Hello</p>&lt;script>alert(1)</script>'
  );
});

it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)'])('blocks the unsafe script URL %s', (url) => {
  expect(enforcingTrustedTypesPolicy.createScriptURL(url)).toBe('about:blank');
});

it.each(['/public/build/app.js', 'https://cdn.example.com/public/build/app.js'])(
  'preserves the asset URL %s',
  (url) => {
    expect(enforcingTrustedTypesPolicy.createScriptURL(url)).toBe(url);
  }
);
