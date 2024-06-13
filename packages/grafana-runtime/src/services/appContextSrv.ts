type AppContextSrv = {
  getContext(): unknown;
  setContext(ctx: unknown): void;
};

class Service {
  #context: unknown = undefined;
  getContext() {
    return this.#context;
  }

  setContext(ctx: unknown) {
    this.#context = ctx;
  }
}

let singletonInstance: AppContextSrv = new Service();

export const setAppContextSrv = (instance: AppContextSrv) => {
  singletonInstance = instance;
};

export const getAppContextService = (): AppContextSrv => singletonInstance;
