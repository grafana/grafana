import { EventEmitter } from 'eventemitter3';

export class Emitter {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  emit(name: string, data?: any) {
    this.emitter.emit(name, data);
  }

  on(name: string, handler: any, scope?: any) {
    this.emitter.on(name, handler);

    if (scope) {
      const unbind = scope.$on('$destroy', () => {
        this.emitter.off(name, handler);
        unbind();
      });
    }
  }

  removeAllListeners(evt?: any) {
    this.emitter.removeAllListeners(evt);
  }

  off(name: any, handler: any) {
    this.emitter.off(name, handler);
  }

  getEventCount(): number {
    return (this.emitter as any)._eventsCount;
  }
}
