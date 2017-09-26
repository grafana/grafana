
import angular from 'angular';
console.log(angular);

import {HelpCtrl} from './core/components/help/help';
console.log(HelpCtrl);

console.log(System);

let path = 'plugins/raintank-worldping-app/grafana-worldmap-panel/module';
System.import(path).then(res => {
  console.log('result', res);
});

