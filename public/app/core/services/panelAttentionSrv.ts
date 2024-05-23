import { PanelAttentionSrv, PanelWithAttention } from '@grafana/runtime';

export class PanelAttentionService implements PanelAttentionSrv {
  private panelId: PanelWithAttention = null;

  getPanelWithAttention(): PanelWithAttention {
    return this.panelId;
  }

  setPanelWithAttention(panelElement: HTMLElement | string | null): void {
    if (!panelElement) {
      return;
    }
    if (panelElement instanceof HTMLElement) {
      this.setPanelIdFromElement(panelElement);
      return;
    }

    if (typeof panelElement === 'string') {
      this.panelId = panelElement;
      return;
    }
  }

  private setPanelIdFromElement(panelElement: HTMLElement): void {
    if (!panelElement) {
      return;
    }

    const panelWithAttention = panelElement.closest('[data-panelid]');

    if (panelWithAttention instanceof HTMLElement && panelWithAttention.dataset?.panelid) {
      this.panelId = parseInt(panelWithAttention.dataset.panelid, 10);
      return;
    }
    this.panelId = null;
  }
}

export const panelAttentionService = new PanelAttentionService();
