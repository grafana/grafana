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

/**
 * A proxy provider that provides a read-only view of an underlying provider.
 *
 * This is useful for plugins that want to use the same provider as Grafana without being able to modify its state or context.
 */
export class ProxyProvider implements Provider {
  readonly runsOn = 'client';
  readonly events = new OpenFeatureEventEmitter();

  private readonly provider: Provider;
  private readonly cleanup: Array<() => void> = [];

  constructor(provider: Provider) {
    this.provider = provider;
    this.registerEventForwarding();
  }

  get metadata() {
    return {
      name: `Proxy(${this.provider.metadata.name})`,
    };
  }

  // Should this wait for the underlying provider to initialize? For now, we don't do anything.
  // In the context of Grafana, this should be fine, as Grafana blocks loading on initializing OpenFeature.
  // Once https://github.com/open-feature/spec/pull/385 lands, there will be an event that we can forward.

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
