import { Oboe, FailReason, PatternMap, CallbackSignature } from 'oboe';

export class MockOboe implements Oboe {
  doAbort: boolean;
  doneCallback: (result: any) => void;
  mockData: any[] | { [key: string]: any };

  constructor(mockData: any[] | {}) {
    this.mockData = mockData;
  }

  done(callback: (result: any) => void): Oboe {
    this.doneCallback = callback;
    return this;
  }

  fail(callback: (result: FailReason) => void): Oboe {
    return this;
  }

  node(pattern: string | PatternMap, callback?: CallbackSignature): Oboe {
    if (callback) {
      const cb = callback.bind(this);

      setTimeout(() => {
        if (Array.isArray(this.mockData)) {
          for (const item of this.mockData) {
            if (!this.doAbort) {
              cb(item, null, []);
            }
          }
        } else {
          for (const key of Object.keys(this.mockData)) {
            if (!this.doAbort) {
              cb(this.mockData[key], [key]);
            }
          }
        }

        this.doneCallback(null);
      }, 10);
    }
    return this;
  }

  on(event: string, pattern: string | CallbackSignature, callback?: CallbackSignature): Oboe {
    return this;
  }

  path(pattern: string | any, callback?: CallbackSignature): Oboe {
    return this;
  }

  removeListener(event: string, pattern: string | CallbackSignature, callback?: CallbackSignature): Oboe {
    return this;
  }

  // eslint-disable-next-line
  start(callback: (status: number, headers: Object) => void): Oboe {
    return this;
  }

  abort(): void {
    this.doAbort = true;
  }

  source: string;
}
