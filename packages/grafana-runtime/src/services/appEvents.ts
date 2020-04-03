import { EventEmitter } from '@grafana/data';

let singletonInstance: EventEmitter;

export const setAppEvents = (instance: EventEmitter) => {
  singletonInstance = instance;
};

export const getAppEvents = (): EventEmitter => singletonInstance;
