import { PanelAttentionSrv, PanelWithAttention } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

export class PanelAttentionService implements PanelAttentionSrv<VizPanel> {
  private panelId: PanelWithAttention = null;
  private vizPanelWithAttention: VizPanel | null = null;

  getPanelWithAttention(): PanelWithAttention | VizPanel {
    return this.panelId || this.vizPanelWithAttention;
  }

  setPanelWithAttention(panelElement: PanelWithAttention | VizPanel): void {
    if (!panelElement) {
      return;
    }
    if (panelElement instanceof HTMLElement) {
      this.setPanelId(panelElement);
      return;
    }

    this.vizPanelWithAttention = panelElement;
  }

  private setPanelId(panelElement: HTMLElement): void {
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
