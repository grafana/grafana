import { EventEmitter } from 'eventemitter3';

export class Emitter {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  emit(name: string, data?: any) {
    this.emitter.emit(name, data);
  }

  on(name: string, handler: (payload?: any) => void, scope?: any) {
    this.emitter.on(name, handler);

    if (scope) {
      const unbind = scope.$on('$destroy', () => {
        this.emitter.off(name, handler);
        unbind();
      });
    }
  }

  removeAllListeners(evt?: string) {
    this.emitter.removeAllListeners(evt);
  }

  off(name: string, handler: (payload?: any) => void) {
    this.emitter.off(name, handler);
  }

  getEventCount(): number {
    return (this.emitter as any)._eventsCount;
  }
}
