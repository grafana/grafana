export interface PanelHit {
  key: string;
  rect: DOMRect;
  title: string;
}

export function findPanelAtPoint(clientX: number, clientY: number): PanelHit | null {
  const els = document.elementsFromPoint(clientX, clientY);
  for (const el of els) {
    const panelEl = (el as Element).closest<HTMLElement>('[data-viz-panel-key]');
    if (!panelEl) {
      continue;
    }
    const key = panelEl.getAttribute('data-viz-panel-key');
    if (!key) {
      continue;
    }
    const titleEl = panelEl.querySelector<HTMLElement>('[data-testid="header-container"] h2, h2, h6');
    return {
      key,
      rect: panelEl.getBoundingClientRect(),
      title: titleEl?.textContent?.trim() ?? '',
    };
  }
  return null;
}

export function getPanelRect(key: string): DOMRect | null {
  const el = document.querySelector<HTMLElement>(`[data-viz-panel-key="${cssEscape(key)}"]`);
  return el ? el.getBoundingClientRect() : null;
}

export function toNormalized(rect: DOMRect, clientX: number, clientY: number): { xNorm: number; yNorm: number } {
  const xNorm = clamp01((clientX - rect.left) / rect.width);
  const yNorm = clamp01((clientY - rect.top) / rect.height);
  return { xNorm, yNorm };
}

export function fromNormalized(rect: DOMRect, xNorm: number, yNorm: number): { x: number; y: number } {
  return {
    x: rect.left + xNorm * rect.width,
    y: rect.top + yNorm * rect.height,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(s);
  }
  return s.replace(/["\\]/g, '\\$&');
}
