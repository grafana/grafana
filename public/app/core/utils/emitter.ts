import EventEmitter3, { EventEmitter } from 'eventemitter3';
import { AppEvent } from '@grafana/data';

export class Emitter {
  private emitter: EventEmitter3;

  constructor() {
    this.emitter = new EventEmitter();
  }

  /**
   * DEPRECATED.
   */
  emit(name: string, data?: any): void;

  /**
   * Emits an `event` with `payload`.
   */
  emit<T extends undefined>(event: AppEvent<T>): void;
  emit<T extends (U extends any ? Partial<T> : unknown) extends T ? Partial<T> : never, U = any>(
    event: AppEvent<T>
  ): void;
  emit<T>(event: AppEvent<T>, payload: T): void;
  emit<T>(event: AppEvent<T> | string, payload?: T | any): void {
    if (typeof event === 'string') {
      console.log(`Using strings as events is deprecated and will be removed in a future version. (${event})`);
      this.emitter.emit(event, payload);
    } else {
      this.emitter.emit(event.name, payload);
    }
  }

  /**
   * DEPRECATED.
   */
  on(name: string, handler: (payload?: any) => void, scope?: any): void;

  /**
   * Handles `event` with `handler()` when emitted.
   */
  on<T extends undefined>(event: AppEvent<T>, handler: () => void, scope?: any): void;
  on<T extends (U extends any ? Partial<T> : unknown) extends T ? Partial<T> : never, U = any>(
    event: AppEvent<T>,
    handler: () => void,
    scope?: any
  ): void;
  on<T>(event: AppEvent<T>, handler: (payload: T) => void, scope?: any): void;
  on<T>(event: AppEvent<T> | string, handler: (payload?: T | any) => void, scope?: any) {
    if (typeof event === 'string') {
      console.log(`Using strings as events is deprecated and will be removed in a future version. (${event})`);
      this.emitter.on(event, handler);

      if (scope) {
        const unbind = scope.$on('$destroy', () => {
          this.emitter.off(event, handler);
          unbind();
        });
      }
      return;
    }

    this.emitter.on(event.name, handler);

    if (scope) {
      const unbind = scope.$on('$destroy', () => {
        this.emitter.off(event.name, handler);
        unbind();
      });
    }
  }

  /**
   * DEPRECATED.
   */
  off(name: string, handler: (payload?: any) => void): void;

  off<T extends undefined>(event: AppEvent<T>, handler: () => void): void;
  off<T extends (U extends any ? Partial<T> : unknown) extends T ? Partial<T> : never, U = any>(
    event: AppEvent<T>,
    handler: () => void,
    scope?: any
  ): void;
  off<T>(event: AppEvent<T>, handler: (payload: T) => void): void;
  off<T>(event: AppEvent<T> | string, handler: (payload?: T | any) => void) {
    if (typeof event === 'string') {
      console.log(`Using strings as events is deprecated and will be removed in a future version. (${event})`);
      this.emitter.off(event, handler);
      return;
    }

    this.emitter.off(event.name, handler);
  }

  removeAllListeners(evt?: string) {
    this.emitter.removeAllListeners(evt);
  }

  getEventCount(): number {
    return (this.emitter as any)._eventsCount;
  }
}
