export class AppPlugin {
  components: {
    ConfigCtrl?: any;
  };

  pages: { [str: string]: any };

  constructor(ConfigCtrl: any) {
    this.components = {
      ConfigCtrl: ConfigCtrl,
    };
    this.pages = {};
  }
}
