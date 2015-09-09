///<reference path="../headers/require.d.ts" />

///<amd-dependency path="../components/panelmeta" />

import PanelMeta = require('../components/panelmeta');
import FileSearcher = require('./fileSearcher');

class Base {

    constructor() {
      var test = new FileSearcher();
      test.getFiles();
    }

    public getName() : string {
      return "asd";
    }
}

export = Base;
