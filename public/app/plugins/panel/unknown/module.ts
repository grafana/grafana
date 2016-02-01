///<reference path="../../../headers/common.d.ts" />

import {PanelDirective} from '../../../features/panel/panel';

class UnknownPanel extends PanelDirective {
  templateUrl = 'public/app/plugins/panel/unknown/module.html';
}


export {
  UnknownPanel,
  UnknownPanel as Panel
}

