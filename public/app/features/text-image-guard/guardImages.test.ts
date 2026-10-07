import { BLOCKED_IMAGE_SRC, guardImages } from './guardImages';

describe('guardImages', () => {
  const template = '<img src="https://avatars.acme.io/u/${__data.fields.login}.png" />';

  it('blocks cross-origin images and marks the interpolated part of the URL', () => {
    const { html, blocked } = guardImages('<img src="https://avatars.acme.io/u/j.smith.png">', template, new Set());

    expect(html).toContain(`src="${BLOCKED_IMAGE_SRC}"`);
    expect(html).toContain('data-blocked-src="https://avatars.acme.io/u/j.smith.png"');
    expect(blocked).toEqual([
      {
        url: 'https://avatars.acme.io/u/j.smith.png',
        host: 'avatars.acme.io',
        containsQueryData: true,
        segments: [
          { text: 'https://avatars.acme.io/u/', fromData: false },
          { text: 'j.smith', fromData: true },
          { text: '.png', fromData: false },
        ],
      },
    ]);
  });

  it('leaves images from allowed hosts untouched', () => {
    const input = '<img src="https://avatars.acme.io/u/j.smith.png">';

    expect(guardImages(input, template, new Set(['avatars.acme.io']))).toEqual({ html: input, blocked: [] });
  });

  it('never blocks same-origin or inline images', () => {
    const input = `<img src="/public/img/logo.svg"><img src="${window.location.origin}/a.png"><img src="data:image/png;base64,AA==">`;

    expect(guardImages(input, '', new Set()).blocked).toEqual([]);
  });

  it('does not flag a static URL written in the template as query data', () => {
    const url = 'https://cdn.example.com/logo.png';
    const { blocked } = guardImages(`<img src="${url}">`, `<img src="${url}">`, new Set());

    expect(blocked[0]).toMatchObject({ containsQueryData: false, segments: [{ text: url, fromData: false }] });
  });
});
