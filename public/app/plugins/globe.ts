let GlobePlugCtrl = {};

export class GlobeCtrl {
  constructor() {}

  getGlobe() {
    return GlobePlugCtrl;
  }

  changeGlobe(newValue: any) {
    GlobePlugCtrl = newValue;
  }
}
