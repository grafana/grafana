import { PanelAttentionSrv, PanelWithAttention } from '@grafana/runtime';

export class PanelAttentionService implements PanelAttentionSrv {
  getPanelWithAttention(): PanelWithAttention {
    return this.getPanelId();
  }
  private elementWithAttention: HTMLElement | null = null;
  setPanelWithAttention(panelElement: HTMLElement | null): void {
    this.elementWithAttention = panelElement;
  }

  getElementWithAttention(): HTMLElement | null {
    return this.elementWithAttention;
  }

  private getPanelId(): number | null {
    if (!this.elementWithAttention) {
      return null;
    }

    const panelWithAttention = this.elementWithAttention.closest('[data-panelid]');

    if (panelWithAttention instanceof HTMLElement && panelWithAttention.dataset?.panelid) {
      return parseInt(panelWithAttention.dataset.panelid, 10);
    }
    return null;
  }
}

export const panelAttentionService = new PanelAttentionService();
