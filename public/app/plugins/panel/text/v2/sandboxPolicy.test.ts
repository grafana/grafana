import { getGlobalFontCss, resourceOrigin, textSandboxPolicy } from './sandboxPolicy';

it('allows only normalized HTTP origins without granting script or connection privileges', () => {
  expect(
    textSandboxPolicy(
      [
        'https://images.example/path?value=secret',
        'https://images.example',
        'data:text/html,x',
        'https://images.example;script-src *',
      ],
      'https://grafana.example/public/fonts/'
    )
  ).toBe(
    "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https://images.example; img-src data: https://images.example; font-src data: https://grafana.example/public/fonts/ https://images.example; media-src https://images.example; frame-src https://images.example; object-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'"
  );
});

it.each(['inline', 'data:image/png,secret', 'blob:https://example.com/id', 'javascript:alert(1)'])(
  'does not turn %s into an origin grant',
  (value) => {
    expect(resourceOrigin(value)).toBeUndefined();
    expect(textSandboxPolicy([value], 'https://grafana.example/public/fonts/')).toContain("frame-src 'none'");
  }
);

it('removes credentials, paths, query values, and fragments from consent details', () => {
  expect(resourceOrigin('https://user:password@external.example:8443/secret?token=value#fragment')).toBe(
    'https://external.example:8443'
  );
});

it('shares font CSS serialization within a mount batch and reads later CSSOM edits', async () => {
  const style = document.createElement('style');
  style.dataset.emotion = 'test-global';
  style.textContent = '@font-face { font-style: normal; } body { color: red; }';
  document.head.append(style);
  // JSDOM does not expose CSSStyleSheet.ownerNode.
  Object.defineProperty(style.sheet, 'ownerNode', { value: style });
  const rule = style.sheet!.cssRules[0] as CSSStyleRule;
  const serialize = jest.spyOn(rule.style, 'getPropertyValue');
  try {
    expect(getGlobalFontCss()).toContain('@font-face {font-style: normal;}');
    expect(getGlobalFontCss()).toContain('@font-face {font-style: normal;}');
    expect(serialize).toHaveBeenCalledTimes(1);
    expect(getGlobalFontCss()).not.toContain('body');
    await Promise.resolve();
    rule.style.setProperty('font-style', 'italic');
    expect(getGlobalFontCss()).toContain('@font-face {font-style: italic;}');
    expect(serialize).toHaveBeenCalledTimes(2);
    style.sheet!.insertRule('@font-face { font-style: oblique; }', 1);
    expect(getGlobalFontCss()).toContain('@font-face {font-style: oblique;}');
    style.remove();
    expect(getGlobalFontCss()).not.toContain('@font-face {font-style: italic;}');
  } finally {
    style.remove();
    serialize.mockRestore();
  }
});
