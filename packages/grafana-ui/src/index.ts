export { Other } from './other';
import { TimeSeries } from '../types';

export class Google {
  data: TimeSeries;

  hello() {
    return 'hello';
  }
}

class Singleton {
  constructor(private state: string) {}

  hello() {
    return this.state;
  }

  change() {
    this.state = 'mod2';
  }
}

const singletonSrv = new Singleton('hello');

export { singletonSrv };
