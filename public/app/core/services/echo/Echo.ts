import { EchoConsumer, EchoMeta, EchoEvent, EchoSrv } from './types';
import { KeyValue, CircularVector } from '@grafana/data';

interface EchoConfig {
  // How often should metrics be reported
  flushInterval: number;
  // Enables debug mode
  debug: boolean;

  // Size of given metric type buffer
  buffersSize: number;
}

/**
 * Echo is a service for collecting metrics from Grafana client-app
 * It collects metrics, distributes them across registered consumers and flushes once per configured interval
 * It's up to the registered consumer to decide what to do with a given type of metric
 */
export class Echo implements EchoSrv {
  private metrics: KeyValue<CircularVector> = {};

  private config: EchoConfig = {
    flushInterval: 10000,
    buffersSize: 100,
    debug: false,
  };
  private consumers: EchoConsumer[] = [];
  // metadata added to every metric consumed
  private meta: EchoMeta;

  constructor(config?: Partial<EchoConfig>) {
    this.config = {
      ...this.config,
      ...config,
    };
    setInterval(this.flush, this.config.flushInterval);
  }

  logDebug = (...msg: any) => {
    if (this.config.debug) {
      // tslint:disable-next-line
      console.debug('ECHO:', ...msg);
    }
  };

  flush = () => {
    this.logDebug('Flushing');
    this.consumers.forEach(c => {
      c.flush();
    });
  };

  addConsumer = (consumer: EchoConsumer) => {
    this.logDebug('Adding consumer', consumer);
    this.consumers.push(consumer);
  };

  consumeEvent = <T extends EchoEvent>(event: Omit<T, 'meta' | 'ts'>) => {
    const meta = this.getMeta();
    const metric = {
      ...event,
      meta,
      ts: performance.now(),
    };

    if (!this.metrics[event.type]) {
      const buffer = new CircularVector({
        capacity: this.config.buffersSize,
      });
      this.metrics[event.type] = buffer;
    }
    this.metrics[event.type].add(metric);

    this.consumers.forEach(c => {
      c.consume(metric);
    });

    this.logDebug('Consuming metric', metric);
  };

  setMeta = (meta: Partial<EchoMeta>) => {
    this.logDebug('Setting meta', meta);
    this.meta = {
      ...this.meta,
      ...meta,
    };
  };

  getMeta = (): EchoMeta => {
    return {
      ...this.meta,
      url: window.location.href,
    };
  };

  getMetrics = () => {
    return this.metrics;
  };
}
