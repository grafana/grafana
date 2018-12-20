export class Google {
  hello() {
    return 'hello';
  }
}

class Singleton {
  constructor(private state) {}

  hello() {
    return this.state;
  }

  change() {
    this.state = 'mod2';
  }
}

const singletonSrv = new Singleton('hello');

export { singletonSrv };
