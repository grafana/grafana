import { sanitizeTextPanelContent } from './sanitize';

describe('Sanitize wrapper', () => {
  it('should allow whitelisted styles in text panel', () => {
    const html =
      '<div style="display:flex; flex-direction: column; flex-wrap: wrap; justify-content: start; gap: 2px;"><div style="flex-basis: 50%"></div></div>';
    const str = sanitizeTextPanelContent(html);
    expect(str).toBe(
      '<div style="display:flex; flex-direction:column; flex-wrap:wrap; justify-content:start; gap:2px;"><div style="flex-basis:50%;"></div></div>'
    );
  });
});
