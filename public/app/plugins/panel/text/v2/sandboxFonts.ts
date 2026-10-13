const fonts = new Map<string, Promise<string>>();

/** Only application-owned global CSS is accepted here, never panel content. */
export async function inlineSandboxFonts(globalCss: string, fontRoot: string): Promise<string> {
  const root = new URL(fontRoot, document.baseURI);
  const urls = Array.from(globalCss.matchAll(/url\(["']?([^"')]+)["']?\)/g));
  const replacements = await Promise.all(
    urls.map(async ([match, value]) => {
      let url: URL;
      try {
        url = new URL(value, document.baseURI);
      } catch {
        return [match, match] as const;
      }
      if (
        !/^https?:$/.test(url.protocol) ||
        url.origin !== root.origin ||
        !url.pathname.startsWith(`${root.pathname.replace(/\/$/, '')}/`) ||
        !/\.(woff2?|ttf|otf)$/.test(url.pathname) ||
        url.search ||
        url.hash ||
        url.username ||
        url.password
      ) {
        return [match, match] as const;
      }
      let font = fonts.get(url.href);
      if (!font) {
        // Font assets lack CORS headers; the opaque frame receives bytes, not broader network privileges.
        font = fetch(url.href, { signal: AbortSignal.timeout(5000) })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error('Font unavailable');
            }
            const blob = await response.blob();
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          })
          .catch(() => '');
        fonts.set(url.href, font);
      }
      const data = await font;
      return [match, data ? `url("${data}")` : 'local("Arial")'] as const;
    })
  );
  let result = globalCss;
  for (const [match, replacement] of replacements) {
    result = result.replaceAll(match, replacement);
  }
  return result;
}
