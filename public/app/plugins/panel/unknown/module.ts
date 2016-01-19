///<reference path="../../../headers/common.d.ts" />

export function unknownPanelDirective() {
  return {
    restrict: 'E',
    template: `
    <grafana-panel>
      <div class="text-center" style="padding-top: 2rem">
          Unknown panel type: <strong>{{panel.type}}</strong>
      </div>
    </grafana-panel>
    `,
  };
}

