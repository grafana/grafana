///<reference path="../../../headers/common.d.ts" />

import {PanelDirective} from '../../../features/panel/panel';

export class UnknownPanel extends PanelDirective {
  template = `<div class="text-center" style="padding-top: 2rem">
                Unknown panel type: <strong>{{ctrl.panel.type}}</strong>
              </div>`;
}


