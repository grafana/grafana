import { PanelAttentionSrv, PanelWithAttention } from '@grafana/runtime';

export class PanelAttentionService implements PanelAttentionSrv {
  private panelId: PanelWithAttention = null;

  getPanelWithAttention(): PanelWithAttention {
    return this.panelId;
  }

  setPanelWithAttention(panelId: PanelWithAttention): void {
    this.panelId = panelId;
  }
}

export const panelAttentionService = new PanelAttentionService();
