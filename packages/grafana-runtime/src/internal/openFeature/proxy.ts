import {
  ClientProviderEvents,
  OpenFeatureEventEmitter,
  type EvaluationContext,
  type EventHandler,
  type JsonValue,
  type Logger,
  type Provider,
  type ProviderEmittableEvents,
  type ResolutionDetails,
} from '@openfeature/web-sdk';

interface Proxyable {
  initialize: Promise<void>;
}

type ProxyableProvider<T extends Provider = Provider> = T & { readonly proxyable: Proxyable };

function createProxyableProvider<
  T extends new (...args: any[]) => Provider, // eslint-disable-line @typescript-eslint/no-explicit-any
>(ProviderClass: T): new (...args: ConstructorParameters<T>) => ProxyableProvider<InstanceType<T>>;
function createProxyableProvider(ProviderClass: new (...args: unknown[]) => Provider) {
  return class ProxyableProviderImpl extends ProviderClass implements ProxyableProvider {
    private initializePromise: Promise<void>;
    private initializeResolve!: () => void;
    private initializeReject!: (err: unknown) => void;

    constructor(...args: unknown[]) {
      super(...args);

      this.initializePromise = new Promise<void>((resolve, reject) => {
        this.initializeResolve = resolve;
        this.initializeReject = reject;
      });
    }

    get proxyable(): Proxyable {
      return {
        initialize: this.initializePromise,
      };
    }

    async initialize(): Promise<void> {
      try {
        await super.initialize?.();
        this.initializeResolve();
      } catch (err) {
        this.initializeReject(err);
        throw err;
      }
    }
  };
}

class ProxyProvider implements Provider {
  readonly runsOn = 'client';
  readonly events = new OpenFeatureEventEmitter();

  private readonly provider: ProxyableProvider;
  private readonly cleanup: Array<() => void> = [];

  constructor(provider: ProxyableProvider) {
    this.provider = provider;
    this.registerEventForwarding();
  }

  hooks = [];

  get metadata() {
    return {
      name: `Proxy(${this.provider.metadata.name})`,
    };
  }

  initialize(): Promise<void> {
    return this.provider.proxyable.initialize;
  }

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    logger: Logger
  ): ResolutionDetails<boolean> {
    return this.provider.resolveBooleanEvaluation(flagKey, defaultValue, context, logger);
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    logger: Logger
  ): ResolutionDetails<string> {
    return this.provider.resolveStringEvaluation(flagKey, defaultValue, context, logger);
  }

  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    logger: Logger
  ): ResolutionDetails<number> {
    return this.provider.resolveNumberEvaluation(flagKey, defaultValue, context, logger);
  }

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    logger: Logger
  ): ResolutionDetails<T> {
    return this.provider.resolveObjectEvaluation(flagKey, defaultValue, context, logger);
  }

  onClose(): Promise<void> {
    this.unregisterEventForwarding();
    return Promise.resolve();
  }

  private registerEventForwarding() {
    const events = [
      ClientProviderEvents.Ready,
      ClientProviderEvents.Error,
      ClientProviderEvents.Stale,
      ClientProviderEvents.ConfigurationChanged,
      ClientProviderEvents.Reconciling,
    ] as const satisfies ProviderEmittableEvents[];

    // Do a compile-time check that we've got all the expected events
    type Missing = Exclude<ProviderEmittableEvents, (typeof events)[number]>;
    const missing: Missing extends never ? null : Missing = null;
    void missing;

    events.forEach((event) => {
      const handler: EventHandler = (...args) => this.events.emit(event, ...args);
      this.provider.events?.addHandler(event, handler);
      this.cleanup.push(() => this.provider.events?.removeHandler(event, handler));
    });
  }

  private unregisterEventForwarding() {
    this.cleanup.forEach((fn) => fn());
    this.cleanup.length = 0;
  }
}

function createProxyProvider(provider: ProxyableProvider): Provider {
  return new ProxyProvider(provider);
}

export { createProxyableProvider, createProxyProvider, type ProxyableProvider, type ProxyProvider };
